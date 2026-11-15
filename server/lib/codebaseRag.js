/**
 * Archon Graph-Aware AST RAG Engine (Section 03: Ask Codebase)
 *
 * Interview-Friendly 4-Stage Pipeline:
 * -------------------------------------------------------------------------
 * Stage 1 — Whole-Project / Report Guard (`shouldRedirectToReports`):
 *   If the user asks for a brief report, detailed report, or a whole-project
 *   question that would require sending ALL files/functions to the LLM, we
 *   do not waste tokens—we ask the user to visit Section 04 (Project Reports)
 *   and provide a one-click redirect button.
 *
 * Stage 2 — Stop-Word & Keyword AST Matcher (`findFunctionsByKeywords`):
 *   Removes stop words from the question, extracts meaningful keywords, and
 *   matches them against AST function names, file paths, imports, and 1-hop
 *   call-graph neighbors (`callsFunctions` / `calledByFunctions`).
 *
 * Stage 3 — SLM Fallback Router (`findFunctionsWithSlm` via `llama-3.1-8b-instant`):
 *   If the keyword matcher finds no matching files/functions (e.g., the user
 *   asked a conceptual question with different wording), we call a fast Small
 *   Language Model (SLM: `llama-3.1-8b-instant`) with only the compact list of
 *   file/function names so the SLM identifies which functions are linked.
 *
 * Stage 4 — Main LLM Answer Generator (`generateAnswerWithLlm` via `llama-3.3-70b-versatile`):
 *   Sends ONLY the matched functions/files (and recent conversation context)
 *   to the main Groq LLM (`llama-3.3-70b-versatile`) to produce a clear,
 *   easy-to-understand explanation.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Clear stop-word list used in Stage 2 to strip conversational filler words from the user's question
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
  "in", "on", "at", "to", "for", "of", "with", "by", "or", "and", "not", "no", "yes",
  "if", "else", "so", "than", "then", "about", "into", "from", "across", "within",
  "between", "around", "inside", "during", "what", "which", "who", "whom", "whose",
  "this", "that", "these", "those", "it", "its", "they", "them", "their", "there", "here",
  "how", "why", "where", "when", "can", "could", "should", "would", "will", "might",
  "do", "does", "did", "done", "have", "has", "had", "explain", "tell", "me", "us",
  "show", "give", "gives", "please", "help", "understand", "work", "works", "working",
  "used", "using", "use", "uses", "code", "codebase", "repo", "repository", "project",
  "app", "application", "function", "functions", "method", "methods", "file", "files",
  "part", "section", "flow", "step", "steps", "trace", "detail", "details",
  "happen", "happens", "happening", "someone", "something",
  "anything", "everything", "just", "only", "very", "really", "actually", "basically",
  "briefly", "shortly", "quickly", "simply", "simple", "short", "small", "quick",
  "mean", "means", "meaning", "purpose", "role", "way", "line", "lines", "value",
  "return", "returns", "returning", "take", "takes", "make", "makes", "get", "gets",
  "check", "checks", "checking", "need", "needs", "want", "call", "called", "calls",
  "defined", "located", "written", "implemented", "handled", "handles", "handle",
]);

const SLM_MODEL = "openai/gpt-oss-20b"; // Fast 20B SLM for file/function routing fallback
const LLM_MODEL = "openai/gpt-oss-120b"; // Main 120B LLM for final code explanation

/**
 * Reads GROQ_API_KEY live from server/.env (or process.env) on every request
 * so pasting a key into .env works immediately without restarting the server.
 */
function getGroqConfig() {
  let apiKey = (process.env.GROQ_API_KEY || "").trim();
  let llmModel = (process.env.GROQ_MODEL || LLM_MODEL).trim();

  const envPaths = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", ".env"),
  ];

  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
        if (parsed.GROQ_API_KEY && parsed.GROQ_API_KEY.trim()) {
          apiKey = parsed.GROQ_API_KEY.trim();
        }
        if (parsed.GROQ_MODEL && parsed.GROQ_MODEL.trim()) {
          llmModel = parsed.GROQ_MODEL.trim();
        }
      }
    } catch {
      // ignore
    }
  }

  return { apiKey, slmModel: SLM_MODEL, llmModel };
}

/**
 * Rough token estimator (~4 characters per token) for UI telemetry
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(String(text).length / 4));
}

/**
 * Lightweight English stem normalizer so plurals & verb forms match cleanly
 * Examples: "credits" -> "credit", "hashed" -> "hash", "deducted" -> "deduct", "buys" -> "buy"
 */
function normalizeStem(word) {
  let w = String(word || "").toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (/(ss|sh|ch|x)es$/.test(w) && w.length > 5) return w.slice(0, -2);
  if (w.endsWith("ing") && w.length > 6) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 5) {
    const base = w.slice(0, -2);
    // handle doubled consonant like "logged" -> "log"
    return base.length >= 4 && base[base.length - 1] === base[base.length - 2]
      ? base.slice(0, -1)
      : base;
  }
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Splits camelCase, snake_case, and file paths into clean lowercase words
 * Example: "findUserByEmailOrSlug" -> ["find", "user", "by", "email", "or", "slug"]
 */
function splitWords(str) {
  if (!str) return [];
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Classifies how broad/detailed the question is so RAG retrieval and LLM
 * response length stay tightly proportional to what the user actually asked.
 */
function detectQueryScope(question) {
  const q = String(question || "").trim();
  const wantsDetail = /\b(in\s+detail|detailed|deep\s*dive|deeply|thoroughly|comprehensive|step[- ]by[- ]step)\b/i.test(q);

  if (
    /\b(blast\s*radius|impact|affect|affected|break|breaks|modify|modifying|remove|removing|delete|callers|who\s+calls|depend\s+on)\b/i.test(
      q
    )
  ) {
    return { scope: "BLAST_RADIUS", wantsDetail };
  }

  if (
    /\b(flow|trace|step[- ]by[- ]step|execution|path|pipeline|end[- ]to[- ]end|workflow|what\s+happens\s+when|how\s+does\s+.*\s+work\s+end)\b/i.test(
      q
    )
  ) {
    return { scope: "FLOW_TRACE", wantsDetail };
  }

  return { scope: "CONCISE_QA", wantsDetail };
}

/**
 * STAGE 1: Check if the question asks for a brief report, detailed report,
 * or whole-project explanation that would require sending ALL files/functions.
 */
function shouldRedirectToReports(question) {
  const q = String(question || "").trim().toLowerCase();

  // Matches requests for brief/detailed reports OR whole-project summaries
  const asksForReport =
    /\b(report|reports|audit|documentation)\b/i.test(q) ||
    /\b(brief|short|detailed|deep|complete|full|entire|whole|overall)\s+(project|codebase|repo|repository|overview|summary|architecture|workflow|workflows|explanation)\b/i.test(
      q
    ) ||
    /\b(explain|summarize|describe|analyse|analyze)\s+(the\s+)?(entire|whole|complete|full|overall)\s+(project|codebase|repo|repository|app|application)\b/i.test(
      q
    ) ||
    /\bwhat\s+(is|does)\s+this\s+(entire\s+|whole\s+)?(project|codebase|repo|repository)\b/i.test(
      q
    ) ||
    /\bbest\s+alternatives?\b/i.test(q);

  return asksForReport;
}

/**
 * STAGE 2: Stop-Word Removal & Keyword Matching over the AST Function Graph
 * Finds which files and functions are linked to the user's question.
 */
function findFunctionsByKeywords(question, allFunctions, memory = {}, queryScope = "CONCISE_QA") {
  const qText = String(question || "");
  const qLower = qText.toLowerCase();

  // Extract standalone identifier tokens (prevents substring false positives like "app" inside "happens")
  const rawTokens = new Set(
    (qText.match(/[a-zA-Z_$][a-zA-Z0-9_$.-]*/g) || []).map((t) =>
      t.toLowerCase().replace(/^\.+|\.+$/g, "")
    )
  );

  // Detect if user explicitly named a specific CamelCase or snake_case symbol (e.g. findUserByEmailOrSlug)
  const explicitSymbols = (qText.match(/\b(?:[a-z]+[A-Z][a-zA-Z0-9]*|[a-z]+_[a-z0-9_]+)\b/g) || [])
    .map((s) => s.toLowerCase());

  if (explicitSymbols.length > 0) {
    const anySymbolExists = allFunctions.some((fn) => {
      const fnL = fn.name.toLowerCase();
      const codeL = String(fn.codeSnippet || "").toLowerCase();
      return explicitSymbols.some((sym) => fnL === sym || codeL.includes(sym));
    });
    // User asked about a specific symbol name that doesn't exist anywhere in the repo;
    // return [] instead of fuzzily matching unrelated functions by sub-words
    if (!anySymbolExists) {
      return [];
    }
  }

  // 1. Remove stop words & stem core keywords
  const keywords = Array.from(
    new Set(splitWords(question).filter((word) => !STOP_WORDS.has(word)))
  );
  const keywordStems = keywords.map(normalizeStem);

  const isFollowUp = /\b(it|its|that|this|they|them)\b/i.test(qLower);
  const pinnedIds = new Set(memory?.pinnedFunctionIds || []);

  const scored = [];

  for (const fn of allFunctions) {
    let score = 0;
    const reasons = [];
    const matchedKeywords = new Set();

    const fnNameLower = fn.name.toLowerCase();
    const fileLower = fn.file.toLowerCase();
    const fnWordStems = new Set(splitWords(fn.name).map(normalizeStem));
    const fileWordStems = new Set(splitWords(fn.file).map(normalizeStem));
    const codeWords = new Set(splitWords(fn.codeSnippet || "").map(normalizeStem));
    const codeLower = String(fn.codeSnippet || "").toLowerCase();
    const importStems = new Set(
      (fn.importedDependencies || [])
        .flatMap((d) => splitWords(d.source))
        .map(normalizeStem)
    );

    // Exact standalone function name match (+60) when user writes the exact symbol/cased name or `fn()`
    const strippedRouteName = fnNameLower.replace(/^(get|post|put|patch|delete)_/, "");
    const hasExplicitFnCall = new RegExp(`\\b${fn.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`, "i").test(qText);
    const hasExactCasedSymbol =
      rawTokens.has(fnNameLower) &&
      (qText.includes(fn.name) || /[_A-Z0-9]/.test(fn.name.slice(1)));

    if (
      hasExplicitFnCall ||
      hasExactCasedSymbol ||
      (strippedRouteName.length >= 3 && rawTokens.has(strippedRouteName) && /^(get|post|put|patch|delete)_/.test(fnNameLower))
    ) {
      score += 60;
      reasons.push(`Mentioned function ${fn.name}()`);
    }

    // Exact standalone file name match (+35)
    const fileBaseWithExt = fn.file.split("/").pop().toLowerCase();
    const fileNameOnly = fileBaseWithExt.replace(/\.[a-z0-9]+$/, "");
    const isGenericFile = ["app", "index", "page", "main", "layout", "server"].includes(fileNameOnly);
    if (
      rawTokens.has(fileBaseWithExt) ||
      (!isGenericFile && fileNameOnly.length >= 4 && rawTokens.has(fileNameOnly) && qText.toLowerCase().includes(`${fileNameOnly}.`))
    ) {
      score += 35;
      reasons.push(`Mentioned file ${fn.file}`);
    }

    // Match extracted stemmed keywords against function name, file path, imports, and code
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      const stem = keywordStems[i];

      if (fnWordStems.has(stem)) {
        score += 22;
        matchedKeywords.add(stem);
        reasons.push(`Function name matches "${kw}"`);
      } else if (fileWordStems.has(stem)) {
        score += 15;
        matchedKeywords.add(stem);
        reasons.push(`File path matches "${kw}"`);
      } else if (importStems.has(stem)) {
        score += 10;
        matchedKeywords.add(stem);
        reasons.push(`Imports "${kw}"`);
      } else if (codeWords.has(stem) || (stem.length >= 5 && codeLower.includes(stem))) {
        score += 6;
        matchedKeywords.add(stem);
        reasons.push(`Code references "${kw}"`);
      }
    }

    // Boost previously discussed functions if this is a follow-up question
    if (pinnedIds.has(fn.id) && (isFollowUp || keywords.length <= 1)) {
      score += 35;
      reasons.push("Remembered from previous question");
    }

    if (score > 0) {
      scored.push({
        fn,
        score,
        matchedCount: matchedKeywords.size,
        matchReasons: Array.from(new Set(reasons)).slice(0, 2),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.matchedCount - a.matchedCount);

  if (scored.length === 0) {
    return [];
  }

  const top = scored[0];
  // Require strong score (>= 12) OR exact keyword coverage; if multi-keyword question
  // only matched 1 keyword weakly without naming a function/file, let SLM Router (Stage 3) inspect!
  if (top.score < 12) {
    return [];
  }
  if (top.score < 35 && keywordStems.length >= 2 && top.matchedCount < 2) {
    return [];
  }

  const maxResults = queryScope === "CONCISE_QA" ? 3 : 5;
  const minThreshold =
    queryScope === "CONCISE_QA"
      ? Math.max(12, top.score * 0.65)
      : Math.max(12, top.score * 0.52);

  return scored
    .filter((item, idx) => idx === 0 || item.score >= minThreshold)
    .slice(0, maxResults);
}

/**
 * Extracts compact, high-signal identifiers & API paths from a function's code
 * so Stage 3 SLM knows what state/DB/endpoints each function actually modifies.
 */
function extractCompactCodeHints(fn) {
  const code = String(fn.codeSnippet || "");
  const noise = new Set([
    "const", "let", "var", "async", "await", "function", "return", "try", "catch",
    "true", "false", "null", "undefined", "req", "res", "next", "err", "error",
    "json", "data", "status", "message", "success", "console", "log", "import",
    "export", "default", "from", "new", "throw", "if", "else", "for", "of",
    "body", "header", "headers", "method", "post", "get", "await", "response",
    "string", "object", "array", "then", "catch", "length", "name", "type",
  ]);
  const counts = new Map();
  // Capture API route literals (e.g. /api/user/login)
  const routeMatches = code.match(/\/api\/[a-zA-Z0-9/_-]+/g) || [];
  for (const r of routeMatches) {
    counts.set(r, (counts.get(r) || 0) + 5);
  }
  // Capture exact camelCase / code identifiers, weighted by occurrence + domain signal
  const idents = code.match(/[a-zA-Z_][a-zA-Z0-9_]{3,}/g) || [];
  for (const id of idents) {
    const low = id.toLowerCase();
    if (noise.has(low) || low === fn.name.toLowerCase()) continue;
    const isMutatingOrDomain = /balance|credit|deduct|update|insert|delete|remove|hash|bcrypt|jwt|token|verify|charge|refund|payment|stock|lock|connect|mongo|prisma|query/i.test(id);
    counts.set(id, (counts.get(id) || 0) + (isMutatingOrDomain ? 4 : 1));
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k)
    .join(",");
}

/**
 * STAGE 3: SLM Fallback Router (`openai/gpt-oss-20b`)
 * Runs when Stage 2 found no confident match (conceptual wording, multi-hop questions, etc.).
 * Sends a compact 1-line index of [id | signature | key hints] and picks only relevant functions.
 */
async function findFunctionsWithSlm(
  question,
  allFunctions,
  apiKey,
  slmModel,
  queryScope = "CONCISE_QA"
) {
  if (!apiKey || allFunctions.length === 0) return [];

  // Curate up to 120 candidate functions so large repos stay well within low token limits
  const qStems = new Set(splitWords(question).filter((w) => !STOP_WORDS.has(w)).map(normalizeStem));
  let candidates = allFunctions;
  if (allFunctions.length > 120) {
    candidates = [...allFunctions]
      .sort((a, b) => {
        const aHits = splitWords(a.name + " " + a.file).filter((w) => qStems.has(normalizeStem(w))).length;
        const bHits = splitWords(b.name + " " + b.file).filter((w) => qStems.has(normalizeStem(w))).length;
        if (bHits !== aHits) return bHits - aHits;
        return (b.criticalityScore || 0) - (a.criticalityScore || 0);
      })
      .slice(0, 120);
  }

  const maxPicks = queryScope === "CONCISE_QA" ? 3 : 4;

  const compactIndex = candidates
    .map((f, idx) => {
      const calls = (f.callsFunctions || []).map((c) => c.name).slice(0, 3).join(",");
      const hints = extractCompactCodeHints(f);
      return `${idx}: ${f.id}${calls ? ` | calls:${calls}` : ""}${hints ? ` | uses:${hints}` : ""}`;
    })
    .join("\n");

  const slmPrompt = [
    `You are a codebase router. Given the user's question and indexed functions, return ONLY a JSON array of the index numbers (1 to ${maxPicks} items) most needed to answer the question accurately. If the user asks about a function that clearly does not exist in the list, return [].`,
    `Example: [4] or [1, 4, 12]`,
    ``,
    `Question: "${question}"`,
    ``,
    `Functions:`,
    compactIndex,
  ].join("\n");

  try {
    const body = {
      model: slmModel,
      temperature: 0,
      messages: [{ role: "user", content: slmPrompt }],
    };
    if (String(slmModel).includes("gpt-oss")) {
      body.reasoning_effort = "low";
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return [];

    const indices = JSON.parse(match[0]);
    const selected = [];
    for (const i of indices) {
      if (candidates[i]) {
        selected.push({
          fn: candidates[i],
          score: 25,
          matchReasons: [`Selected by SLM Router (${slmModel})`],
        });
      }
    }
    return selected.slice(0, maxPicks);
  } catch {
    return [];
  }
}

/**
 * Identifies generic shadcn/Radix UI wrapper components (Button, Label, Input, etc.)
 * so AST call-graph expansion skips them in favor of actual app/business logic.
 */
function isUiPrimitiveFunction(fn) {
  if (!fn) return false;
  const fLower = String(fn.file || "").toLowerCase();
  if (fLower.includes("/components/ui/") || fLower.includes("/ui/")) return true;
  return /^(button|input|label|checkbox|card|card\w+|table|table\w+|tabs|tabs\w+|select|select\w+|textarea|badge|dialog|dialog\w+|cn)$/i.test(
    fn.name || ""
  );
}

/**
 * Expand matched functions in the AST Call Graph cleanly based on question scope:
 * - For CONCISE_QA: keep only the directly matched functions (max 3) and lightweight caller/callee stubs.
 * - For FLOW_TRACE / BLAST_RADIUS: expand 1-hop connected neighbors & build interactive callChain.
 */
function expandWithCallGraphNeighbors(seedEntries, allFunctions, queryScope = "CONCISE_QA") {
  const fnById = new Map(allFunctions.map((f) => [f.id, f]));
  const primaryMap = new Map(seedEntries.map((item) => [item.fn.id, item]));
  const callChain = [];
  const neighborStubs = [];

  const expandFullNeighborBodies = queryScope !== "CONCISE_QA";
  const maxPrimaryCount = queryScope === "CONCISE_QA" ? 3 : 5;

  for (const { fn } of seedEntries) {
    callChain.push({
      id: fn.id,
      name: fn.name,
      file: fn.file,
      startLine: fn.startLine,
      criticality: fn.criticality,
      role: "Matched Function",
    });

    for (const calleeRef of fn.callsFunctions || []) {
      const calleeFn = fnById.get(calleeRef.id);
      if (!calleeFn || isUiPrimitiveFunction(calleeFn)) continue;

      if (!callChain.some((c) => c.id === calleeFn.id)) {
        callChain.push({
          id: calleeFn.id,
          name: calleeFn.name,
          file: calleeFn.file,
          startLine: calleeFn.startLine,
          criticality: calleeFn.criticality,
          role: `Called by ${fn.name}()`,
        });
      }

      if (
        expandFullNeighborBodies &&
        !primaryMap.has(calleeFn.id) &&
        primaryMap.size < maxPrimaryCount
      ) {
        primaryMap.set(calleeFn.id, {
          fn: calleeFn,
          score: 15,
          matchReasons: [`Called by ${fn.name}()`],
        });
      } else if (!primaryMap.has(calleeFn.id)) {
        neighborStubs.push({
          fn: calleeFn,
          relation: `Called by ${fn.name}()`,
        });
      }
    }

    for (const callerRef of fn.calledByFunctions || []) {
      const callerFn = fnById.get(callerRef.id);
      if (!callerFn || primaryMap.has(callerFn.id) || isUiPrimitiveFunction(callerFn)) {
        continue;
      }

      if (queryScope === "BLAST_RADIUS" && primaryMap.size < maxPrimaryCount) {
        primaryMap.set(callerFn.id, {
          fn: callerFn,
          score: 14,
          matchReasons: [`Calls ${fn.name}()`],
        });
      } else {
        neighborStubs.push({
          fn: callerFn,
          relation: `Calls ${fn.name}()`,
        });
      }
    }

    // Bridge frontend API calls (e.g. /api/auth/signin) to backend controllers/handlers in FLOW_TRACE
    if (queryScope === "FLOW_TRACE" && primaryMap.size < maxPrimaryCount) {
      const apiMatches = String(fn.codeSnippet || "").match(/\/api\/[a-zA-Z0-9/_-]+/g) || [];
      for (const apiPath of apiMatches) {
        const tail = apiPath.split("/").filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!tail || tail.length < 3) continue;
        const backendTarget = allFunctions.find(
          (candidate) =>
            !primaryMap.has(candidate.id) &&
            !isUiPrimitiveFunction(candidate) &&
            /server|backend|controller|route|api/i.test(candidate.file || "") &&
            (candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "") === tail ||
              candidate.name.toLowerCase().includes(tail))
        );
        if (backendTarget && primaryMap.size < maxPrimaryCount) {
          primaryMap.set(backendTarget.id, {
            fn: backendTarget,
            score: 18,
            matchReasons: [`Handles ${apiPath}`],
          });
          if (!callChain.some((c) => c.id === backendTarget.id)) {
            callChain.push({
              id: backendTarget.id,
              name: backendTarget.name,
              file: backendTarget.file,
              startLine: backendTarget.startLine,
              criticality: backendTarget.criticality,
              role: `Handles ${apiPath}`,
            });
          }
          // Also include 1-hop backend callees of this handler
          for (const subCallee of backendTarget.callsFunctions || []) {
            const subFn = fnById.get(subCallee.id);
            if (subFn && !isUiPrimitiveFunction(subFn) && !callChain.some((c) => c.id === subFn.id)) {
              callChain.push({
                id: subFn.id,
                name: subFn.name,
                file: subFn.file,
                startLine: subFn.startLine,
                criticality: subFn.criticality,
                role: `Called by ${backendTarget.name}()`,
              });
              if (!primaryMap.has(subFn.id) && primaryMap.size < maxPrimaryCount) {
                primaryMap.set(subFn.id, {
                  fn: subFn,
                  score: 14,
                  matchReasons: [`Called by ${backendTarget.name}()`],
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    primaryEntries: Array.from(primaryMap.values()).slice(0, maxPrimaryCount),
    neighborStubs: neighborStubs.slice(0, 6),
    callChain: callChain.slice(0, 8),
  };
}

/**
 * STAGE 4: Send ONLY the linked functions & files to the Main Groq LLM
 * with a scope-aware concise system prompt so small questions get short, crisp answers.
 */
async function generateAnswerWithGroqLlm({
  question,
  analysis,
  primaryEntries,
  neighborStubs,
  history,
  apiKey,
  llmModel,
  queryScope = "CONCISE_QA",
  wantsDetail = false,
  noDirectMatch = false,
}) {
  const functionContextBlocks =
    primaryEntries.length > 0
      ? primaryEntries
          .map(({ fn }, idx) => {
            const calls = (fn.callsFunctions || []).map((c) => `${c.name}()`).join(", ");
            const calledBy = (fn.calledByFunctions || []).map((c) => `${c.name}()`).join(", ");
            const lines = [
              `Function #${idx + 1}: ${fn.name}() in "${fn.file}" (Lines ${fn.startLine}-${fn.endLine})`,
              calls || calledBy
                ? `Calls: ${calls || "None"} | Called by: ${calledBy || "Entry point"}`
                : "",
              queryScope === "BLAST_RADIUS"
                ? `Blast Radius: ${fn.affectedFilesCount} file(s) (${fn.blastRadiusPercent}% of repo)${
                    (fn.affectedFilesIfChanged || fn.usedByFiles || []).length > 0
                      ? ` | Affected files: ${(fn.affectedFilesIfChanged || fn.usedByFiles).join(", ")}`
                      : ""
                  }`
                : "",
              `\`\`\`${(fn.language || "javascript").toLowerCase()}\n${fn.codeSnippet || fn.signature}\n\`\`\``,
            ];
            return lines.filter(Boolean).join("\n");
          })
          .join("\n\n")
      : "No matching functions or symbols found in the indexed repository.";

  const neighborContext =
    queryScope !== "CONCISE_QA" && neighborStubs.length > 0
      ? `Connected Neighbor Functions:\n` +
        neighborStubs
          .map(({ fn, relation }) => `- ${fn.name}() in ${fn.file} (${relation})`)
          .join("\n")
      : "";

  const scopeInstruction = wantsDetail
    ? `Mode: DETAILED EXPLANATION — The user asked for detail. Explain clearly with structured bullets, keeping code snippets brief.`
    : queryScope === "BLAST_RADIUS"
    ? `Mode: BLAST RADIUS — Lead immediately with the affected files count & %, list the exact affected files/callers cleanly, and stop. No filler.`
    : queryScope === "FLOW_TRACE"
    ? `Mode: EXECUTION FLOW — STRICT LIMIT: Write AT MOST 5–6 short numbered steps (~60–110 words total). Merge validation/UI details together so each step covers one meaningful stage (\`fn()\` / endpoint / DB / JWT / redirect). NEVER output separate steps for preventDefault, req.body, loading state, or finally.`
    : `Mode: DIRECT CONCISE Q&A — Answer small/direct questions in 2–4 short sentences or 3–4 crisp bullets. Get straight to the point on sentence 1.`;

  const systemPrompt = [
    `You are Archon, a crisp, accurate codebase assistant for "${analysis.fullName}".`,
    `You only see the minimal AST-retrieved functions/files relevant to the question.`,
    scopeInstruction,
    ``,
    `Strict Rules:`,
    `1. MATCH LENGTH TO THE QUESTION: Small/simple questions MUST get short, direct answers (~25–80 words). Do NOT write long tutorials, redundant "In short / Summary" recaps, "---" horizontal dividers, or multi-heading essays for simple questions.`,
    `2. NO TRIVIAL NARRATION: Never explain basic JavaScript/Python syntax like try/catch, async/await, req/res parameters, or simple destructuring unless asked.`,
    `3. ZERO HALLUCINATION: Rely strictly on the retrieved code & AST metadata below. NEVER write code blocks or specific route/middleware names (like \`authMiddleware\`) from a file whose code is NOT shown in the retrieved context—simply name the affected file as listed.`,
    `4. CLEAN INLINE REFERENCES: Cite short identifiers inline (\`fn()\`, \`filePath\`, \`/api/...\`). NEVER wrap multi-argument \`fetch(...)\` calls, JSON bodies, or template literals in inline backticks—describe payloads in plain words or use a small fenced code block only if strictly needed. Never use Markdown tables or <br> tags.`,
  ].join("\n");

  const userPrompt = [
    `Repository: ${analysis.fullName} (${analysis.primaryLanguage})`,
    noDirectMatch
      ? `Note: No exact function/file named in the question exists in the indexed AST of this repository.`
      : "",
    ``,
    `=== RETRIEVED AST CONTEXT ===`,
    functionContextBlocks,
    neighborContext,
    ``,
    `=== QUESTION ===`,
    question,
  ]
    .filter(Boolean)
    .join("\n");

  const recentHistory = (history || [])
    .slice(-4)
    .filter((m) => m && m.content && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 500),
    }));

  const modelsToTry = Array.from(
    new Set([llmModel, LLM_MODEL, SLM_MODEL, "qwen/qwen3.8-27b"])
  );

  for (const model of modelsToTry) {
    try {
      const body = {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          ...recentHistory,
          { role: "user", content: userPrompt },
        ],
      };
      if (String(model).includes("gpt-oss")) {
        body.reasoning_effort = "low";
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(22000),
      });

      if (res.ok) {
        const data = await res.json();
        const answerText = data?.choices?.[0]?.message?.content;
        const promptTokens = data?.usage?.prompt_tokens || estimateTokens(userPrompt);
        if (answerText) {
          return {
            ok: true,
            text: answerText,
            engine: `Groq LLM (${model})`,
            tokensSent: promptTokens,
          };
        }
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[Groq LLM ${res.status} on ${model}]:`, errText.slice(0, 200));
      }
    } catch (err) {
      console.warn(`[Groq LLM error on ${model}]:`, err.message);
    }
  }

  return { ok: false, tokensSent: estimateTokens(userPrompt) };
}

/**
 * Simple, friendly explanation fallback ONLY if GROQ_API_KEY is missing in server/.env
 */
function buildSimpleFallbackExplanation(question, analysis, primaryEntries) {
  if (primaryEntries.length === 0) {
    return `I couldn't find any specific function matching **"${question}"** in \`${analysis.fullName}\`. Try mentioning a feature, file name, or function name.`;
  }

  const mainFn = primaryEntries[0].fn;
  const otherFns = primaryEntries.slice(1).map((p) => p.fn);
  const callsList = (mainFn.callsFunctions || []).map((c) => `\`${c.name}()\``).join(", ");
  const callersList = (mainFn.calledByFunctions || []).map((c) => `\`${c.name}()\``).join(", ");

  return [
    `### How \`${mainFn.name}()\` Works`,
    `Your question links to **\`${mainFn.name}()\`** in **\`${mainFn.file}\`** (lines ${mainFn.startLine}–${mainFn.endLine}).`,
    `- **What triggers it**: ${callersList ? `It is called by ${callersList}.` : `It acts as an entry-point function/handler in \`${mainFn.file}\`.`}`,
    `- **What it calls next**: ${callsList ? `Inside its body, it calls ${callsList} to complete the workflow.` : `It handles the logic directly without calling other internal functions.`}`,
    `- **Impact if changed**: Modifying \`${mainFn.name}()\` affects **${mainFn.affectedFilesCount} file(s)** (${mainFn.blastRadiusPercent}% of the project).`,
    otherFns.length > 0
      ? `- **Connected functions also involved**: ${otherFns.map((f) => `\`${f.name}()\` (\`${f.file}\`)`).join(", ")}.`
      : "",
    `\`\`\`${(mainFn.language || "javascript").toLowerCase()}\n${mainFn.codeSnippet || mainFn.signature}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Main Entry Point Called by `POST /api/projects/:id/ask`
 */
async function answerCodebaseQuestion({
  analysis,
  question,
  history = [],
  memory = {},
}) {
  const allFiles = analysis?.files || [];
  const allFunctions = analysis?.functions || [];

  // Calculate full repository token size so we can show how many tokens RAG saved
  const fullRepoChars =
    allFiles.reduce((acc, f) => acc + (f.sizeBytes || (f.lines || 40) * 38), 0) +
    1500;
  const fullRepoTokens = Math.max(1000, Math.ceil(fullRepoChars / 4));

  // =========================================================================
  // STAGE 1: Whole-Project / Brief or Detailed Report Guard -> Redirect to Section 04
  // =========================================================================
  if (shouldRedirectToReports(question)) {
    return {
      answer: [
        `### Check **Section 04: Project Reports** for Full Project & Report Explanations`,
        `Answering this question requires analyzing the **entire repository across all ${allFiles.length} files and ${allFunctions.length} functions**.`,
        `To avoid sending the entire codebase into chat tokens, we have dedicated **Section 04: Project Reports** for whole-project overviews, where you can view:`,
        `- **Brief Project Report** — What the project is, what problem it solves, and the tech stack it uses.`,
        `- **Detailed Developer Report** — Deep dive into every function, package versions & best alternatives, and all major workflows.`,
        `Click the button below to go directly to the **Project Reports** section.`,
      ].join("\n\n"),
      intent: "REPORT_REDIRECT",
      redirectAction: {
        targetSection: "reports",
        buttonLabel: "Go to Project Reports (Section 04) →",
        description:
          "View the Brief Overview Report & Detailed Developer Report in Section 04",
      },
      telemetry: {
        intent: "REPORT_REDIRECT",
        intentLabel: "Redirected to Reports",
        retrievalMethod: "Stage 1: Whole-Project Guard (0 Tokens)",
        functionsRetrieved: 0,
        neighborStubsCount: 0,
        totalRepoFunctions: allFunctions.length,
        filesTouched: 0,
        totalRepoFiles: allFiles.length,
        tokensSent: 0,
        fullRepoTokens,
        tokensSaved: fullRepoTokens,
        tokensSavedPercent: 100,
        engine: "Report Guard (0 Tokens)",
        groqConfigured: Boolean(getGroqConfig().apiKey),
      },
      retrievedFunctions: [],
      neighborStubs: [],
      callChain: [],
      updatedMemory: memory || {},
      suggestedFollowUps: allFunctions[0]
        ? [
            `How does ${allFunctions[0].name}() work?`,
            `Which files are affected if we change ${allFunctions[0].name}()?`,
          ]
        : [],
    };
  }

  const { apiKey, slmModel, llmModel } = getGroqConfig();
  const { scope: queryScope, wantsDetail } = detectQueryScope(question);

  // =========================================================================
  // STAGE 2: Find Linked Files & Functions Using Stop-Words + Keywords
  // =========================================================================
  let matchedSeeds = findFunctionsByKeywords(
    question,
    allFunctions,
    memory,
    queryScope
  );
  let retrievalMethod = "Stage 2: Stop-Word & Keyword AST Match";

  // =========================================================================
  // STAGE 3: If Keyword Filter Found Nothing (or low confidence), Use SLM Router
  // =========================================================================
  if (matchedSeeds.length === 0 && apiKey) {
    matchedSeeds = await findFunctionsWithSlm(
      question,
      allFunctions,
      apiKey,
      slmModel,
      queryScope
    );
    if (matchedSeeds.length > 0) {
      retrievalMethod = `Stage 3: SLM Router (${slmModel})`;
    }
  }

  const noDirectMatch = matchedSeeds.length === 0;
  if (noDirectMatch) {
    retrievalMethod = "Stage 3: No Matching AST Symbol";
  }

  // Expand matched seeds cleanly according to query scope
  const { primaryEntries, neighborStubs, callChain } = noDirectMatch
    ? { primaryEntries: [], neighborStubs: [], callChain: [] }
    : expandWithCallGraphNeighbors(matchedSeeds, allFunctions, queryScope);

  // =========================================================================
  // STAGE 4: Send Matched Functions & Files to Groq LLM
  // =========================================================================
  let finalAnswer = "";
  let engineLabel = "AST Fallback (Add GROQ_API_KEY for Groq LLM)";
  let tokensSent = estimateTokens(
    primaryEntries.map((p) => p.fn.codeSnippet || "").join("\n")
  );

  if (apiKey) {
    const llmResult = await generateAnswerWithGroqLlm({
      question,
      analysis,
      primaryEntries,
      neighborStubs,
      history,
      apiKey,
      llmModel,
      queryScope,
      wantsDetail,
      noDirectMatch,
    });
    if (llmResult.ok) {
      finalAnswer = llmResult.text;
      engineLabel = llmResult.engine;
      tokensSent = llmResult.tokensSent;
    }
  }

  if (!finalAnswer) {
    finalAnswer = buildSimpleFallbackExplanation(
      question,
      analysis,
      primaryEntries
    );
  }

  const tokensSaved = Math.max(0, fullRepoTokens - tokensSent);
  const tokensSavedPercent =
    fullRepoTokens > tokensSent
      ? Math.min(
          99,
          +(((fullRepoTokens - tokensSent) / fullRepoTokens) * 100).toFixed(1)
        )
      : 85;

  // Update conversational memory with the functions we just discussed
  const newPinnedIds = primaryEntries.slice(0, 3).map((p) => p.fn.id);
  const updatedMemory = {
    pinnedFunctionIds: Array.from(
      new Set([...newPinnedIds, ...(memory?.pinnedFunctionIds || [])])
    ).slice(0, 5),
    pinnedFiles: Array.from(
      new Set(primaryEntries.slice(0, 3).map((p) => p.fn.file))
    ),
  };

  // Build simple, meaningful follow-up suggestions (excluding UI primitives like Button/Label)
  const fn0 = primaryEntries[0]?.fn;
  const meaningfulCallee = primaryEntries
    .slice(1)
    .map((p) => p.fn)
    .concat(
      (fn0?.callsFunctions || [])
        .map((c) => allFunctions.find((f) => f.id === c.id))
        .filter(Boolean)
    )
    .find((f) => f && f.id !== fn0?.id && !isUiPrimitiveFunction(f));

  const suggestedFollowUps = [];
  if (fn0) {
    suggestedFollowUps.push(
      `What is the blast radius if we change ${fn0.name}()?`
    );
    if (meaningfulCallee) {
      suggestedFollowUps.push(
        `How does ${meaningfulCallee.name}() work?`
      );
    }
  }
  if (suggestedFollowUps.length < 2) {
    suggestedFollowUps.push(`Generate a detailed report of the entire project`);
  }

  return {
    answer: finalAnswer,
    intent: "RAG_QA",
    redirectAction: null,
    telemetry: {
      intent: "RAG_QA",
      intentLabel: retrievalMethod,
      retrievalMethod,
      functionsRetrieved: primaryEntries.length,
      neighborStubsCount: neighborStubs.length,
      totalRepoFunctions: allFunctions.length,
      filesTouched: new Set(primaryEntries.map((p) => p.fn.file)).size,
      totalRepoFiles: allFiles.length,
      tokensSent,
      fullRepoTokens,
      tokensSaved,
      tokensSavedPercent,
      engine: engineLabel,
      groqConfigured: Boolean(apiKey),
    },
    retrievedFunctions: primaryEntries.map(({ fn, matchReasons }) => ({
      id: fn.id,
      name: fn.name,
      signature: fn.signature,
      file: fn.file,
      startLine: fn.startLine,
      endLine: fn.endLine,
      lineCount: fn.lineCount,
      language: fn.language,
      criticality: fn.criticality,
      criticalityScore: fn.criticalityScore,
      blastRadiusPercent: fn.blastRadiusPercent,
      affectedFilesCount: fn.affectedFilesCount,
      matchReasons,
    })),
    neighborStubs: neighborStubs.map(({ fn, relation }) => ({
      id: fn.id,
      name: fn.name,
      signature: fn.signature,
      file: fn.file,
      startLine: fn.startLine,
      criticality: fn.criticality,
      relation,
    })),
    callChain,
    updatedMemory,
    suggestedFollowUps: suggestedFollowUps.slice(0, 3),
  };
}

module.exports = {
  answerCodebaseQuestion,
  getGroqConfig,
};
