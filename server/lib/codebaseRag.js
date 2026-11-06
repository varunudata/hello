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

// Small, clear stop-word list used in Stage 2 to strip filler words from the user's question
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "in", "on", "at",
  "to", "for", "of", "with", "by", "about", "into", "from", "what", "which",
  "who", "this", "that", "these", "those", "how", "why", "where", "when",
  "can", "could", "should", "would", "will", "do", "does", "did", "explain",
  "tell", "me", "show", "give", "please", "help", "understand", "work", "works",
  "working", "used", "using", "use", "code", "codebase", "repo", "repository",
  "project", "function", "functions", "file", "files", "part", "section", "flow",
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
function findFunctionsByKeywords(question, allFunctions, memory = {}) {
  const qLower = String(question || "").toLowerCase();

  // 1. Remove stop words to get the core keywords from the user's question
  const keywords = splitWords(question).filter((word) => !STOP_WORDS.has(word));

  // Check if the user is asking a follow-up ("how does it work?", "what calls that?")
  const isFollowUp = /\b(it|its|that|this|they|them)\b/.test(qLower);
  const pinnedIds = new Set(memory?.pinnedFunctionIds || []);

  const scored = [];

  for (const fn of allFunctions) {
    let score = 0;
    const reasons = [];

    const fnNameLower = fn.name.toLowerCase();
    const fileLower = fn.file.toLowerCase();
    const fnWords = splitWords(fn.name);
    const fileWords = splitWords(fn.file);
    const codeLower = String(fn.codeSnippet || "").toLowerCase();
    const importWords = (fn.importedDependencies || []).flatMap((d) =>
      splitWords(d.source)
    );

    // Direct function name or file name mention in the question
    if (fnNameLower.length >= 3 && qLower.includes(fnNameLower)) {
      score += 50;
      reasons.push(`Mentioned function ${fn.name}()`);
    }

    const fileNameOnly = fn.file.split("/").pop().toLowerCase().replace(/\.[a-z0-9]+$/, "");
    if (fileNameOnly.length >= 4 && fileNameOnly !== "page" && fileNameOnly !== "index" && qLower.includes(fileNameOnly)) {
      score += 30;
      reasons.push(`Mentioned file ${fn.file}`);
    }

    // Match extracted non-stopword keywords against function name, file path, imports, and code
    for (const kw of keywords) {
      if (fnWords.includes(kw) || fnNameLower.includes(kw)) {
        score += 20;
        reasons.push(`Function name matches "${kw}"`);
      } else if (fileWords.includes(kw) || fileLower.includes(kw)) {
        score += 15;
        reasons.push(`File path matches "${kw}"`);
      } else if (importWords.includes(kw)) {
        score += 10;
        reasons.push(`Imports "${kw}"`);
      } else if (codeLower.includes(kw)) {
        score += 5;
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
        matchReasons: Array.from(new Set(reasons)).slice(0, 2),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Keep only strong keyword matches; if none are strong, return [] so Stage 3 (SLM) runs!
  if (scored.length === 0 || scored[0].score < 10) {
    return [];
  }

  const topScore = scored[0].score;
  return scored
    .filter((item, idx) => idx < 2 || item.score >= topScore * 0.45)
    .slice(0, 5);
}

/**
 * STAGE 3: SLM Fallback Router (`llama-3.1-8b-instant`)
 * Runs ONLY when Stage 2 (stop-words + keywords) found no matching functions.
 * Sends a compact index of [functionId | file | signature] to the SLM and asks
 * it which functions are needed to answer the question.
 */
async function findFunctionsWithSlm(question, allFunctions, apiKey, slmModel) {
  if (!apiKey || allFunctions.length === 0) return [];

  // Send only compact 1-line function headers (very low token usage!)
  const compactIndex = allFunctions
    .slice(0, 80)
    .map(
      (f, idx) =>
        `${idx}: ${f.id} (${f.signature}, calls: ${(f.callsFunctions || [])
          .map((c) => c.name)
          .slice(0, 3)
          .join(",")})`
    )
    .join("\n");

  const slmPrompt = [
    `You are a codebase router. Given the user's question and the list of functions in the repository, return ONLY a JSON array of the index numbers (at most 4) of the functions most relevant to answering the question.`,
    `Example response: [0, 4, 12]`,
    ``,
    `Question: "${question}"`,
    ``,
    `Functions:`,
    compactIndex,
  ].join("\n");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: slmModel,
        temperature: 0,
        messages: [{ role: "user", content: slmPrompt }],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const match = text.match(/\[[\d,\s]+\]/);
    if (!match) return [];

    const indices = JSON.parse(match[0]);
    const selected = [];
    for (const i of indices) {
      if (allFunctions[i]) {
        selected.push({
          fn: allFunctions[i],
          score: 25,
          matchReasons: [`Selected by SLM Router (${slmModel})`],
        });
      }
    }
    return selected.slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Expand matched functions by 1 hop in the AST Call Graph so connected
 * helper/caller functions in the workflow are also included.
 */
function expandWithCallGraphNeighbors(seedEntries, allFunctions) {
  const fnById = new Map(allFunctions.map((f) => [f.id, f]));
  const primaryMap = new Map(seedEntries.map((item) => [item.fn.id, item]));
  const callChain = [];
  const neighborStubs = [];

  for (const { fn } of seedEntries) {
    callChain.push({
      id: fn.id,
      name: fn.name,
      file: fn.file,
      startLine: fn.startLine,
      criticality: fn.criticality,
      role: "Matched Function",
    });

    // Include direct functions called by this function
    for (const calleeRef of fn.callsFunctions || []) {
      const calleeFn = fnById.get(calleeRef.id);
      if (!calleeFn) continue;

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

      if (!primaryMap.has(calleeFn.id) && primaryMap.size < 6) {
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

    // Also record upstream callers as compact 1-line neighbor stubs
    for (const callerRef of fn.calledByFunctions || []) {
      const callerFn = fnById.get(callerRef.id);
      if (callerFn && !primaryMap.has(callerFn.id)) {
        neighborStubs.push({
          fn: callerFn,
          relation: `Calls ${fn.name}()`,
        });
      }
    }
  }

  return {
    primaryEntries: Array.from(primaryMap.values()),
    neighborStubs: neighborStubs.slice(0, 8),
    callChain: callChain.slice(0, 8),
  };
}

/**
 * STAGE 4: Send ONLY the linked functions & files to the Main Groq LLM
 * (`llama-3.3-70b-versatile`) to generate a clear, simple, natural explanation.
 */
async function generateAnswerWithGroqLlm({
  question,
  analysis,
  primaryEntries,
  neighborStubs,
  history,
  apiKey,
  llmModel,
}) {
  const functionContextBlocks = primaryEntries
    .map(({ fn, matchReasons }, idx) => {
      const calls = (fn.callsFunctions || []).map((c) => `${c.name}()`).join(", ");
      const calledBy = (fn.calledByFunctions || []).map((c) => `${c.name}()`).join(", ");
      return [
        `Function #${idx + 1}: ${fn.name}() in file "${fn.file}" (Lines ${fn.startLine}-${fn.endLine})`,
        `Why selected: ${matchReasons.join(", ")}`,
        `Calls: ${calls || "None"} | Called by: ${calledBy || "Entry point"}`,
        `If changed/removed affects: ${fn.affectedFilesCount} file(s) (${fn.blastRadiusPercent}% of repo)`,
        `Code:\n\`\`\`${(fn.language || "javascript").toLowerCase()}\n${fn.codeSnippet || fn.signature}\n\`\`\``,
      ].join("\n");
    })
    .join("\n\n");

  const neighborContext =
    neighborStubs.length > 0
      ? `Connected Neighbor Functions:\n` +
        neighborStubs
          .map(
            ({ fn, relation }) =>
              `- ${fn.name}() in ${fn.file} (${relation})`
          )
          .join("\n")
      : "";

  const systemPrompt = [
    `You are a friendly, clear Senior Software Engineer helping a developer understand the "${analysis.fullName}" codebase.`,
    `You have been given ONLY the specific files and functions linked to the user's question by our AST RAG pipeline.`,
    `Rules for your response:`,
    `1. Explain the answer in simple, clear, natural English that is easy to read and understand.`,
    `2. Walk through how the relevant function(s) work step by step using numbered or bulleted lists, mentioning the file name and function name naturally.`,
    `3. Do NOT use Markdown tables or raw HTML tags like <br>. Use clean headings (###, ####), bullet points, and short paragraphs.`,
    `4. Keep code snippets short and only show the few lines that matter.`,
  ].join("\n");

  const userPrompt = [
    `Repository: ${analysis.fullName} (${analysis.primaryLanguage})`,
    ``,
    `=== RELEVANT FUNCTIONS & FILES RETRIEVED BY AST RAG ===`,
    functionContextBlocks,
    neighborContext,
    ``,
    `=== USER QUESTION ===`,
    question,
  ]
    .filter(Boolean)
    .join("\n");

  const recentHistory = (history || [])
    .slice(-4)
    .filter((m) => m && m.content && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 700),
    }));

  const modelsToTry = Array.from(
    new Set([llmModel, LLM_MODEL, SLM_MODEL, "qwen/qwen3.8-27b"])
  );

  for (const model of modelsToTry) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          messages: [
            { role: "system", content: systemPrompt },
            ...recentHistory,
            { role: "user", content: userPrompt },
          ],
        }),
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

  // =========================================================================
  // STAGE 2: Find Linked Files & Functions Using Stop-Words + Keywords
  // =========================================================================
  let matchedSeeds = findFunctionsByKeywords(question, allFunctions, memory);
  let retrievalMethod = "Stage 2: Stop-Word & Keyword AST Match";

  // =========================================================================
  // STAGE 3: If Keyword Filter Found Nothing, Use SLM (`llama-3.1-8b-instant`)
  // =========================================================================
  if (matchedSeeds.length === 0 && apiKey) {
    matchedSeeds = await findFunctionsWithSlm(
      question,
      allFunctions,
      apiKey,
      slmModel
    );
    if (matchedSeeds.length > 0) {
      retrievalMethod = `Stage 3: SLM Router (${slmModel})`;
    }
  }

  // Last-resort fallback if neither keywords nor SLM matched (e.g. very vague prompt)
  if (matchedSeeds.length === 0 && allFunctions.length > 0) {
    matchedSeeds = allFunctions.slice(0, 3).map((fn) => ({
      fn,
      score: 10,
      matchReasons: ["Top entry/core function in repository"],
    }));
  }

  // Expand matched seeds with 1-hop call-graph neighbors
  const { primaryEntries, neighborStubs, callChain } =
    expandWithCallGraphNeighbors(matchedSeeds, allFunctions);

  // =========================================================================
  // STAGE 4: Send Matched Functions & Files to Groq LLM (`llama-3.3-70b-versatile`)
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

  // Build simple follow-up suggestions
  const fn0 = primaryEntries[0]?.fn;
  const suggestedFollowUps = [];
  if (fn0) {
    suggestedFollowUps.push(
      `What happens if we modify or remove ${fn0.name}()?`
    );
    if (fn0.callsFunctions?.[0]) {
      suggestedFollowUps.push(
        `How does ${fn0.callsFunctions[0].name}() work?`
      );
    }
  }
  suggestedFollowUps.push(`Generate a detailed report of the entire project`);

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
