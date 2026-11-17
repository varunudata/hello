/**
 * Archon Project Intelligence Reports Generator (Section 04)
 *
 * Strictly uses Groq's flagship model (`openai/gpt-oss-120b`) to synthesize a clear,
 * presentation-ready Brief Overview Report from a compact whole-repo AST digest
 * designed to cover the entire project cleanly under Groq's 8,000 TPM budget.
 */

const {
  getGroqConfig,
  isUiPrimitiveFunction,
  extractCompactCodeHints,
  estimateTokens,
} = require("./codebaseRag");

const BEST_GROQ_REPORT_MODEL = "openai/gpt-oss-120b";

/**
 * Assigns an architectural layer label to a file path.
 */
function inferFileLayer(filePath = "") {
  const f = String(filePath).toLowerCase();
  if (/(^|\/)(prisma|models?|schemas?|db|mongodb|database|migrations?)(\/|\.)/.test(f)) {
    return "Database & Models";
  }
  if (/(^|\/)(routes?|controllers?|middleware|middlewares|api|handlers?)(\/|\.)/.test(f)) {
    return "API & Controllers";
  }
  if (/(^|\/)(services?|lib|utils?|helpers?|engine|workers?|jobs?|hooks?)(\/|\.)/.test(f)) {
    return "Core Logic & Services";
  }
  if (/(^|\/)(client|frontend|pages?|app|components?|views?|context|store|src\/ui)(\/|\.)/.test(f)) {
    return "Frontend & UI";
  }
  if (/(server|index|main|config|settings|setup)\./.test(f)) {
    return "Entry & Config";
  }
  return "Application Module";
}

/**
 * Builds a complete, whole-repository architectural digest (~1,400–2,300 tokens)
 * so every project fits comfortably in a single `openai/gpt-oss-120b` call
 * without hitting Groq's 8,000 TPM cap.
 */
function buildBriefReportRepoDigest(analysis) {
  const files = analysis?.files || [];
  const functions = analysis?.functions || [];
  const packages = analysis?.packages || [];
  const languages = analysis?.languages || [];

  const langSummary =
    languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ") ||
    analysis?.primaryLanguage ||
    "Unknown";

  // Top external packages sorted by file usage count (hard-capped for huge monorepos)
  const packageSummary =
    packages.length > 0
      ? packages
          .slice(0, 35)
          .map((p) => `${p.name}(${p.usedInFilesCount}f)`)
          .join(", ") +
        (packages.length > 35 ? `, +${packages.length - 35} more` : "")
      : "None detected";

  // Group files by inferred architectural layer, separating shadcn/ui primitives cleanly
  const filesByLayer = new Map();
  const uiPrimitiveFiles = [];

  for (const file of files) {
    const fLower = String(file.path || "").toLowerCase();
    if (fLower.includes("/components/ui/") || fLower.includes("/ui/")) {
      uiPrimitiveFiles.push(file.path);
      continue;
    }
    const layer = inferFileLayer(file.path);
    if (!filesByLayer.has(layer)) filesByLayer.set(layer, []);
    filesByLayer.get(layer).push(file);
  }

  const fileSections = [];
  for (const [layer, layerFiles] of filesByLayer.entries()) {
    const lines = layerFiles.slice(0, 22).map((file) => {
      const fnNames = functions
        .filter((fn) => fn.file === file.path && !isUiPrimitiveFunction(fn))
        .sort((a, b) => (b.criticalityScore || 0) - (a.criticalityScore || 0))
        .map((fn) => fn.name)
        .slice(0, 5)
        .join(",");
      return `- ${file.path} (${file.lines || 0}L${fnNames ? ` | fns:${fnNames}` : ""})`;
    });
    if (layerFiles.length > 22) {
      lines.push(`- ...+${layerFiles.length - 22} more ${layer} files`);
    }
    fileSections.push(`[${layer}]\n${lines.join("\n")}`);
  }

  if (uiPrimitiveFiles.length > 0) {
    fileSections.push(
      `[UI Primitives]\n- ${uiPrimitiveFiles.length} shared UI wrapper files (${uiPrimitiveFiles
        .slice(0, 5)
        .map((f) => f.split("/").pop())
        .join(", ")}${uiPrimitiveFiles.length > 5 ? ", …" : ""})`
    );
  }

  // Select up to 34 meaningful non-primitive functions spanning ALL architectural layers
  const meaningfulFns = functions.filter((fn) => !isUiPrimitiveFunction(fn));
  const selectedFns = [];
  const selectedIds = new Set();

  const layerBuckets = new Map();
  for (const fn of meaningfulFns) {
    const layer = inferFileLayer(fn.file);
    if (!layerBuckets.has(layer)) layerBuckets.set(layer, []);
    layerBuckets.get(layer).push(fn);
  }
  for (const bucket of layerBuckets.values()) {
    for (const fn of bucket.slice(0, 6)) {
      if (!selectedIds.has(fn.id)) {
        selectedIds.add(fn.id);
        selectedFns.push(fn);
      }
    }
  }
  for (const fn of meaningfulFns) {
    if (selectedFns.length >= 34) break;
    if (!selectedIds.has(fn.id)) {
      selectedIds.add(fn.id);
      selectedFns.push(fn);
    }
  }

  // Compact signature + AST edges + domain token hints per function (fits huge repos cleanly!)
  const fnDigest = selectedFns
    .map((fn) => {
      const calls = (fn.callsFunctions || [])
        .map((c) => c.name)
        .filter((n) => !/^(button|input|label|checkbox|card|table|tabs|select|badge|cn)$/i.test(n))
        .slice(0, 4)
        .join(",");
      const callers = (fn.calledByFunctions || [])
        .map((c) => c.name)
        .slice(0, 3)
        .join(",");
      const hints = extractCompactCodeHints(fn);
      return `• ${fn.name}() @ ${fn.file} [${inferFileLayer(fn.file)} | ${fn.criticality} ${fn.blastRadiusPercent}%]${
        calls ? ` | calls:${calls}` : ""
      }${callers ? ` | callers:${callers}` : ""}${hints ? ` | uses:${hints}` : ""}`;
    })
    .join("\n");

  let digest = [
    `=== REPO ===`,
    `Name: ${analysis?.fullName || analysis?.repoName || "Repository"}`,
    `Description: ${String(analysis?.description || "Not provided").slice(0, 500)}`,
    `Languages: ${langSummary}`,
    `Metrics: ${analysis?.fileCount || files.length} files, ${analysis?.functionCount || functions.length} AST functions, ${analysis?.packageCount || packages.length} packages, ${analysis?.totalLines || 0} LOC, Health ${analysis?.healthScore || 90}%`,
    `Packages: ${packageSummary}`,
    ``,
    `=== ARCHITECTURE FILES ===`,
    fileSections.join("\n"),
    ``,
    `=== CORE FUNCTIONS ACROSS LAYERS ===`,
    fnDigest || "No parsed functions found.",
  ].join("\n");

  // Hard guard so even gigantic 100+ file monorepos never push prompt past ~2,600 tokens
  if (digest.length > 9800) {
    digest = digest.slice(0, 9800) + "\n...(additional helper functions omitted for brevity)";
  }

  return digest;
}

/**
 * Normalizes the LLM's structured JSON report and protects against partial fields.
 */
function normalizeBriefReport(rawJson, analysis, modelUsed, tokensUsed) {
  const safeStr = (v, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  const safeArr = (v) => (Array.isArray(v) ? v : []);

  const layers = safeArr(rawJson?.architectureDesign?.layers).map((l, idx) => ({
    stepOrder: idx + 1,
    layerName: safeStr(l?.layerName, `Layer ${idx + 1}`),
    role: safeStr(l?.role, ""),
    technologies: safeArr(l?.technologies).filter(Boolean),
    keyFiles: safeArr(l?.keyFiles).filter(Boolean),
  }));

  const steps = safeArr(rawJson?.completeWorkflow?.steps).map((s, idx) => ({
    stepNumber: Number(s?.stepNumber) || idx + 1,
    actor: safeStr(s?.actor, "SYSTEM").toUpperCase(),
    title: safeStr(s?.title, `Stage ${idx + 1}`),
    summary: safeStr(s?.summary, ""),
    keyComponent: safeStr(s?.keyComponent, ""),
    output: safeStr(s?.output, ""),
  }));

  const secondaryFlows = safeArr(rawJson?.completeWorkflow?.secondaryFlows)
    .map((flow) => ({
      name: safeStr(flow?.name, "Workflow"),
      summary: safeStr(flow?.summary, ""),
      steps: safeArr(flow?.steps).filter(Boolean),
    }))
    .filter((f) => f.steps.length > 0);

  const techStack = safeArr(rawJson?.techStack)
    .map((group) => ({
      category: safeStr(group?.category, "Core Tools"),
      purposeSummary: safeStr(group?.purposeSummary, ""),
      items: safeArr(group?.items)
        .map((it) => ({
          name: safeStr(it?.name, ""),
          roleInProject: safeStr(it?.roleInProject, ""),
        }))
        .filter((it) => it.name),
    }))
    .filter((g) => g.items.length > 0);

  const filesAndModules = safeArr(rawJson?.filesAndModules)
    .map((mod) => ({
      folderOrCategory: safeStr(mod?.folderOrCategory, "Core Modules"),
      summary: safeStr(mod?.summary, ""),
      files: safeArr(mod?.files)
        .map((f) => ({
          path: safeStr(f?.path, ""),
          role: safeStr(f?.role, ""),
          layer: safeStr(f?.layer, inferFileLayer(f?.path)),
        }))
        .filter((f) => f.path),
    }))
    .filter((m) => m.files.length > 0);

  const mainFunctions = safeArr(rawJson?.mainFunctions)
    .map((fn) => ({
      name: safeStr(fn?.name, "").replace(/\(\)$/, ""),
      file: safeStr(fn?.file, ""),
      layer: safeStr(fn?.layer, inferFileLayer(fn?.file)),
      whatItDoes: safeStr(fn?.whatItDoes, ""),
      interactsWith: safeStr(fn?.interactsWith, ""),
    }))
    .filter((fn) => fn.name);

  const keyTakeaways = safeArr(rawJson?.keyTakeaways)
    .map((tk) => ({
      tag: safeStr(tk?.tag, "Insight"),
      title: safeStr(tk?.title, "Architecture Note"),
      detail: safeStr(tk?.detail, ""),
    }))
    .filter((tk) => tk.detail);

  // Backfill filesAndModules cleanly from AST if model skipped any group
  const normalizedFilesAndModules =
    filesAndModules.length > 0
      ? filesAndModules
      : buildFallbackBriefReport(analysis).filesAndModules;

  // Backfill keyTakeaways cleanly if empty
  const normalizedTakeaways =
    keyTakeaways.length > 0
      ? keyTakeaways
      : buildFallbackBriefReport(analysis).keyTakeaways;

  return {
    type: "BRIEF",
    repoFullName: analysis?.fullName || analysis?.repoName,
    headline: safeStr(
      rawJson?.headline,
      analysis?.description || `Architecture & functional overview of ${analysis?.fullName}`
    ),
    whatIsProject: safeStr(rawJson?.whatIsProject, analysis?.description || ""),
    problemAndSolution: {
      problem: safeStr(rawJson?.problemAndSolution?.problem, ""),
      solution: safeStr(rawJson?.problemAndSolution?.solution, ""),
      idealUseCases: safeArr(rawJson?.problemAndSolution?.idealUseCases).filter(Boolean),
    },
    architectureDesign: {
      pattern: safeStr(
        rawJson?.architectureDesign?.pattern,
        `${analysis?.primaryLanguage || "Modular"} Application Architecture`
      ),
      layers,
    },
    completeWorkflow: {
      overview: safeStr(rawJson?.completeWorkflow?.overview, ""),
      steps,
      secondaryFlows,
    },
    techStack,
    filesAndModules: normalizedFilesAndModules,
    mainFunctions,
    keyTakeaways: normalizedTakeaways,
    meta: {
      model: modelUsed,
      tokensUsed,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Deterministic fallback ONLY if GROQ_API_KEY is absent or Groq fails completely.
 */
function buildFallbackBriefReport(analysis, reason = "") {
  const functions = (analysis?.functions || []).filter((f) => !isUiPrimitiveFunction(f));
  const files = (analysis?.files || []).filter(
    (f) => !String(f.path || "").toLowerCase().includes("/components/ui/")
  );
  const packages = analysis?.packages || [];

  const layersMap = new Map();
  for (const file of files) {
    const layer = inferFileLayer(file.path);
    if (!layersMap.has(layer)) layersMap.set(layer, []);
    layersMap.get(layer).push(file);
  }

  return {
    type: "BRIEF",
    repoFullName: analysis?.fullName || analysis?.repoName,
    headline:
      analysis?.description ||
      `AST-indexed ${analysis?.primaryLanguage} codebase with ${analysis?.fileCount || 0} files and ${analysis?.functionCount || 0} functions.`,
    whatIsProject:
      analysis?.description ||
      `${analysis?.fullName} is a ${analysis?.primaryLanguage} software repository containing ${analysis?.fileCount || 0} source files and ${analysis?.functionCount || 0} parsed functions.`,
    problemAndSolution: {
      problem: reason
        ? `Groq synthesis temporarily unavailable (${reason}). Displaying AST structural brief.`
        : "Organizes application workflows cleanly across modular layers.",
      solution: `Combines ${packages.slice(0, 5).map((p) => p.name).join(", ") || analysis?.primaryLanguage} across ${files.length} source files.`,
      idealUseCases: ["Engineering onboarding", "Architecture & stakeholder overview"],
    },
    architectureDesign: {
      pattern: `${analysis?.primaryLanguage || "Modular"} Codebase`,
      layers: Array.from(layersMap.entries()).map(([layerName, layerFiles], idx) => ({
        stepOrder: idx + 1,
        layerName,
        role: `${layerFiles.length} source file(s) handling ${layerName.toLowerCase()}`,
        technologies: Array.from(
          new Set(layerFiles.flatMap((f) => (f.imports || []).filter((i) => i.isExternal).map((i) => i.source)))
        ).slice(0, 4),
        keyFiles: layerFiles.slice(0, 4).map((f) => f.path),
      })),
    },
    completeWorkflow: {
      overview: "User actions flow from UI/entry modules through processing controllers into storage or API outputs.",
      steps: Array.from(layersMap.entries()).map(([layerName, layerFiles], idx) => ({
        stepNumber: idx + 1,
        actor: layerName.split(" ")[0].toUpperCase(),
        title: layerName,
        summary: `Implemented across ${layerFiles.slice(0, 3).map((f) => f.path).join(", ")}.`,
        keyComponent: layerFiles[0]?.path || "",
        output: "Passes processed state or response downstream",
      })),
      secondaryFlows: [],
    },
    techStack: packages.length
      ? [
          {
            category: "Detected Packages & Libraries",
            purposeSummary: "External dependencies imported across source files",
            items: packages.slice(0, 12).map((p) => ({
              name: p.name,
              roleInProject: `Imported in ${p.usedInFilesCount} file(s)`,
            })),
          },
        ]
      : [],
    filesAndModules: Array.from(layersMap.entries()).map(([folderOrCategory, layerFiles]) => ({
      folderOrCategory,
      summary: `${layerFiles.length} core file(s) in this layer`,
      files: layerFiles.slice(0, 8).map((f) => ({
        path: f.path,
        role: `${f.lines || 0} lines · ${f.functionCount || 0} parsed function(s)`,
        layer: folderOrCategory,
      })),
    })),
    mainFunctions: functions.slice(0, 8).map((fn) => ({
      name: fn.name,
      file: fn.file,
      layer: inferFileLayer(fn.file),
      whatItDoes: fn.criticalityReason || fn.signature,
      interactsWith:
        (fn.callsFunctions || []).map((c) => `${c.name}()`).slice(0, 4).join(", ") || "Standalone module logic",
    })),
    keyTakeaways: [
      {
        tag: "Scale",
        title: "Indexed Codebase Footprint",
        detail: `${analysis?.fileCount || 0} source files, ${analysis?.functionCount || 0} AST functions, and ${analysis?.totalLines || 0} total lines (health score: ${analysis?.healthScore || 90}%).`,
      },
    ],
    meta: {
      model: "AST Fallback",
      tokensUsed: 0,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Generates the presentation-ready Brief Overview Report strictly via Groq's
 * flagship `openai/gpt-oss-120b` model.
 */
async function generateBriefProjectReport(analysis) {
  const { apiKey } = getGroqConfig();
  const repoDigest = buildBriefReportRepoDigest(analysis);
  const estimatedInputTokens = estimateTokens(repoDigest);

  if (!apiKey) {
    return buildFallbackBriefReport(analysis, "GROQ_API_KEY not configured in server/.env");
  }

  const systemPrompt = [
    `You write clear, engaging, presentation-ready Brief Overview Reports for software repositories ("${analysis?.fullName || analysis?.repoName}").`,
    ``,
    `AUDIENCE:`,
    `- Non-coders & data analysts making PPT decks or understanding what the software achieves.`,
    `- Beginners/students new to tech and engineers wanting a fast, complete overview of the whole project.`,
    ``,
    `STYLE & COMPLETENESS RULES:`,
    `1. READABLE, NEVER EXHAUSTING: Do NOT squeeze fields artificially to 1-2 cramped lines, and do NOT write dense academic walls of text. Write clear, crisp, natural English with helpful plain-language analogies where technical terms (JWT, bcrypt, webhooks, AST, ORM, Redis) appear.`,
    `2. COMPLETE EVERY SECTION: You MUST populate ALL JSON keys cleanly—especially \`filesAndModules\`, \`mainFunctions\`, and \`keyTakeaways\`. Keep each field concise enough so the entire JSON object fits comfortably under 2,500 output tokens without ever truncating.`,
    `3. DYNAMIC \`mainFunctions\`: Never force a fixed number! Include whichever core functions are genuinely needed to understand how this repo works (could be 3 on a tiny utility app, or 8–12+ across UI/API/controllers/DB on a full-stack app). Skip trivial UI primitives like Button, Label, Input, cn.`,
    `4. STRICTLY GROUNDED: Mention ONLY real files, packages, endpoints, and functions present in the digest below.`,
    ``,
    `RETURN VALID JSON MATCHING THIS SCHEMA:`,
    `{`,
    `  "headline": "1 crisp plain-English sentence capturing the whole project",`,
    `  "whatIsProject": "Clear, inviting 1-2 short paragraphs explaining what this software does, who it is for, and how it helps them.",`,
    `  "problemAndSolution": {`,
    `    "problem": "Real-world problem or workflow gap this project solves.",`,
    `    "solution": "How this application solves it end to end in simple terms.",`,
    `    "idealUseCases": ["3-4 concise slide-ready use cases or audiences"]`,
    `  },`,
    `  "architectureDesign": {`,
    `    "pattern": "Short name of system architecture (e.g. React SPA + Express API + MongoDB)",`,
    `    "layers": [`,
    `      { "layerName": "Layer title", "role": "1-2 sentences on what this layer handles", "technologies": ["Tech1"], "keyFiles": ["file1.js"] }`,
    `    ]`,
    `  },`,
    `  "completeWorkflow": {`,
    `    "overview": "1-2 sentences explaining how a request/user journey flows across the whole system.",`,
    `    "steps": [`,
    `      { "stepNumber": 1, "actor": "USER|FRONTEND|API|CORE LOGIC|DATABASE|EXTERNAL API", "title": "Stage title", "summary": "What happens & why", "keyComponent": "file or fn()", "output": "Result passed onward" }`,
    `    ],`,
    `    "secondaryFlows": [`,
    `      { "name": "Distinct sub-workflow (e.g. Auth Flow / Payment Flow)", "summary": "1 sentence purpose", "steps": ["Step 1", "Step 2", "Step 3"] }`,
    `    ]`,
    `  },`,
    `  "techStack": [`,
    `    {`,
    `      "category": "Frontend UI | Backend & APIs | Database & Storage | Security & Auth | AI & External APIs",`,
    `      "purposeSummary": "Short group purpose",`,
    `      "items": [{ "name": "Tool/Package", "roleInProject": "Plain-English role in this repo" }]`,
    `    }`,
    `  ],`,
    `  "filesAndModules": [`,
    `    {`,
    `      "folderOrCategory": "Module group name",`,
    `      "summary": "What this folder/group handles",`,
    `      "files": [{ "path": "exact/file/path", "layer": "Frontend & UI|API & Controllers|Core Logic & Services|Database & Models", "role": "Clear 1-sentence purpose" }]`,
    `    }`,
    `  ],`,
    `  "mainFunctions": [`,
    `    { "name": "fnName", "file": "exact/file/path", "layer": "Layer", "whatItDoes": "Clear explanation of what this function does & why it matters.", "interactsWith": "Functions, APIs, or DB models it connects with" }`,
    `  ],`,
    `  "keyTakeaways": [`,
    `    { "tag": "Strength|Security|Architecture|Risk", "title": "Short title", "detail": "Concise slide-ready insight." }`,
    `  ]`,
    `}`,
  ].join("\n");

  const modelsToTry = [BEST_GROQ_REPORT_MODEL];

  for (const model of modelsToTry) {
    // Allow 1 gentle retry after 2s only if Groq hits a transient 429 rate-limit burst
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body = {
          model,
          temperature: 0.25,
          max_completion_tokens: 4500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: repoDigest },
          ],
        };

        if (model.includes("gpt-oss")) {
          body.reasoning_effort = "low";
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45000),
        });

        if (res.status === 429 && attempt === 0) {
          const retryAfterSec = parseFloat(res.headers.get("retry-after") || "3");
          const waitMs = Math.min(12000, Math.max(2500, Math.ceil(retryAfterSec * 1000) + 400));
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[Brief Report Groq ${res.status} on ${model}]:`, errText.slice(0, 220));
          break;
        }

        const data = await res.json();
        const rawContent = data?.choices?.[0]?.message?.content;
        if (!rawContent) break;

        let parsed;
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (parsed && typeof parsed === "object") {
          const totalTokens =
            data?.usage?.total_tokens ||
            (data?.usage?.prompt_tokens || estimatedInputTokens) +
              (data?.usage?.completion_tokens || estimateTokens(rawContent));
          return normalizeBriefReport(parsed, analysis, model, totalTokens);
        }
      } catch (err) {
        console.warn(`[Brief Report error on ${model}]:`, err.message);
      }
    }
  }

  return buildFallbackBriefReport(analysis, "Groq API rate limit or network timeout");
}

/**
 * Deterministically scans all parsed AST function bodies for environment variable
 * references (`process.env.X`, `import.meta.env.X`, `os.getenv("X")`, `os.environ["X"]`)
 * and maps each variable to the exact files and functions where it appears.
 */
function extractEnvVariablesFromAnalysis(analysis) {
  const envMap = new Map();
  const functions = analysis?.functions || [];

  const recordEnv = (varName, file, fnName) => {
    if (!varName || varName.length < 2 || varName === "NODE_ENV") return;
    if (!envMap.has(varName)) {
      envMap.set(varName, { name: varName, files: new Set(), functions: new Set() });
    }
    if (file) envMap.get(varName).files.add(file);
    if (fnName) envMap.get(varName).functions.add(fnName);
  };

  for (const fn of functions) {
    const code = String(fn.codeSnippet || "");
    const dotMatches = code.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g);
    for (const m of dotMatches) {
      recordEnv(m[1], fn.file, fn.name);
    }
    const pyMatches = code.matchAll(/(?:os\.getenv|os\.environ\.get)\(\s*["']([A-Z0-9_]+)["']/g);
    for (const m of pyMatches) {
      recordEnv(m[1], fn.file, fn.name);
    }
  }

  return Array.from(envMap.values()).map((item) => ({
    name: item.name,
    files: Array.from(item.files),
    functions: Array.from(item.functions),
  }));
}

/**
 * Helper to call Groq (`openai/gpt-oss-120b` first) with automatic 429 retry-after backoff.
 */
async function callGroqJsonWithRetry({
  apiKey,
  systemPrompt,
  userPrompt,
  maxCompletionTokens = 4500,
  label = "Detailed Report",
}) {
  const modelsToTry = [BEST_GROQ_REPORT_MODEL, "qwen/qwen3.8-27b"];

  for (const model of modelsToTry) {
    const maxAttempts = model === BEST_GROQ_REPORT_MODEL ? 3 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const body = {
          model,
          temperature: 0.2,
          max_completion_tokens: maxCompletionTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        };

        if (model.includes("gpt-oss")) {
          body.reasoning_effort = "low";
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(55000),
        });

        if (res.status === 429) {
          const retryHeader = parseFloat(res.headers.get("retry-after") || "4");
          const errBody = await res.text().catch(() => "");
          const secMatch = errBody.match(/try again in ([0-9.]+)s/i);
          const waitSec = secMatch ? parseFloat(secMatch[1]) : retryHeader;
          // If the rate-limit wait is short (<= 6s) and we have retries left on 120B, wait and retry 120B;
          // otherwise fall through to the next high-capability Groq model immediately for fast UX.
          if (attempt < maxAttempts - 1 && waitSec <= 6.5) {
            const waitMs = Math.min(7000, Math.max(2000, Math.ceil(waitSec * 1000) + 400));
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          break;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[${label} Groq ${res.status} on ${model}]:`, errText.slice(0, 220));
          break;
        }

        const data = await res.json();
        const rawContent = data?.choices?.[0]?.message?.content;
        if (!rawContent) break;

        let parsed = null;
        try {
          parsed = JSON.parse(rawContent);
        } catch {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }

        if (parsed && typeof parsed === "object") {
          const tokens =
            data?.usage?.total_tokens ||
            estimateTokens(userPrompt) + estimateTokens(rawContent);
          return { parsed, model, tokens };
        }
      } catch (err) {
        console.warn(`[${label} error on ${model}]:`, err.message);
      }
    }
  }

  return { parsed: null, model: "AST Fallback", tokens: 0 };
}

/**
 * Builds the focused Pass 1 digest (Architecture + Workflows + Packages & Versions).
 */
function buildDetailedPass1Digest(analysis) {
  const files = analysis?.files || [];
  const functions = (analysis?.functions || []).filter((f) => !isUiPrimitiveFunction(f));
  const packages = analysis?.packages || [];

  // Map each package to the exact files that import it
  const pkgFilesMap = new Map();
  for (const file of files) {
    for (const imp of file.imports || []) {
      if (imp.isExternal) {
        const basePkg = imp.source.startsWith("@")
          ? imp.source.split("/").slice(0, 2).join("/")
          : imp.source.split("/")[0];
        if (!pkgFilesMap.has(basePkg)) pkgFilesMap.set(basePkg, []);
        if (pkgFilesMap.get(basePkg).length < 4) {
          pkgFilesMap.get(basePkg).push(file.path);
        }
      }
    }
  }

  const pkgLines = packages.slice(0, 32).map((p) => {
    const usedFiles = pkgFilesMap.get(p.name) || [];
    return `- ${p.name} @ ${p.version || "latest"} (${p.type || "prod"}, ${p.usedInFilesCount}f${
      usedFiles.length ? `: ${usedFiles.join(", ")}` : ""
    })`;
  });

  const fileLines = files
    .filter((f) => !String(f.path || "").toLowerCase().includes("/components/ui/"))
    .slice(0, 40)
    .map((f) => {
      const fns = functions
        .filter((fn) => fn.file === f.path)
        .map((fn) => fn.name)
        .slice(0, 6)
        .join(", ");
      return `- ${f.path} [${inferFileLayer(f.path)} | ${f.lines || 0}L]${fns ? ` fns: ${fns}` : ""}`;
    });

  // Include top 14 route/controller/service/page functions with compact 10-line code slices
  const workflowFns = [...functions]
    .sort((a, b) => {
      const aBoost = /route|controller|auth|service|context|page|server|db/i.test(a.file) ? 25 : 0;
      const bBoost = /route|controller|auth|service|context|page|server|db/i.test(b.file) ? 25 : 0;
      return b.criticalityScore + bBoost - (a.criticalityScore + aBoost);
    })
    .slice(0, 20);

  const fnLines = workflowFns.map((fn, idx) => {
    const calls = (fn.callsFunctions || []).map((c) => `${c.name}() in ${c.file}`).slice(0, 4).join(", ");
    const callers = (fn.calledByFunctions || []).map((c) => `${c.name}() in ${c.file}`).slice(0, 3).join(", ");
    const hints = extractCompactCodeHints(fn);
    const snippet =
      idx < 10 && fn.codeSnippet
        ? `\n${fn.codeSnippet.split("\n").slice(0, 12).join("\n")}`
        : "";
    return `• ${fn.name}() in ${fn.file} (L${fn.startLine}-L${fn.endLine}) | calls: ${calls || "none"} | calledBy: ${
      callers || "entry"
    }${hints ? ` | uses: ${hints}` : ""}${snippet}`;
  });

  let digest = [
    `=== REPOSITORY ===`,
    `Name: ${analysis?.fullName || analysis?.repoName}`,
    `Description: ${String(analysis?.description || "").slice(0, 400)}`,
    `Stats: ${analysis?.fileCount || files.length} files, ${analysis?.functionCount || 0} functions, ${analysis?.packageCount || packages.length} packages, ${analysis?.totalLines || 0} LOC, Health ${analysis?.healthScore || 90}%`,
    ``,
    `=== PACKAGES & EXACT VERSIONS ===`,
    pkgLines.join("\n") || "No external packages",
    ``,
    `=== SOURCE FILES ===`,
    fileLines.join("\n"),
    ``,
    `=== KEY WORKFLOW FUNCTIONS ===`,
    fnLines.join("\n\n"),
  ].join("\n");

  if (digest.length > 8800) {
    digest = digest.slice(0, 8800);
  }
  return digest;
}

/**
 * Builds the focused Pass 2 digest (Files, Core Functions & Out-of-the-Box Playbook).
 */
function buildDetailedPass2Digest(analysis, envVars) {
  const files = (analysis?.files || []).filter(
    (f) => !String(f.path || "").toLowerCase().includes("/components/ui/")
  );
  const functions = (analysis?.functions || []).filter((f) => !isUiPrimitiveFunction(f));

  const fileSummary = files
    .slice(0, 36)
    .map((f) => {
      const extImports = (f.imports || [])
        .map((i) => i.source)
        .slice(0, 5)
        .join(", ");
      const fns = functions
        .filter((fn) => fn.file === f.path)
        .map((fn) => fn.name)
        .slice(0, 6)
        .join(", ");
      return `- ${f.path} (${f.lines || 0}L | imports: ${extImports || "none"} | fns: ${fns || "none"})`;
    })
    .join("\n");

  const topFns = functions.slice(0, 26).map((fn, idx) => {
    const calls = (fn.callsFunctions || []).map((c) => c.name).slice(0, 4).join(",");
    const callers = (fn.calledByFunctions || []).map((c) => c.name).slice(0, 4).join(",");
    const hints = extractCompactCodeHints(fn);
    const snippet =
      idx < 12 && fn.codeSnippet
        ? `\n${fn.codeSnippet.split("\n").slice(0, 10).join("\n")}`
        : "";
    return `• ${fn.id} | sig: ${fn.signature} | L${fn.startLine}-L${fn.endLine} | blast: ${fn.blastRadiusPercent}% (${fn.affectedFilesCount}f) | calls:${calls || "none"} | callers:${callers || "entry"} | tokens:${hints}${snippet}`;
  });

  const envLines =
    envVars.length > 0
      ? envVars.map((e) => `- ${e.name} (used in ${e.files.join(", ")})`).join("\n")
      : "No explicit process.env variables detected in snippets";

  let digest = [
    `=== REPOSITORY ===`,
    `Name: ${analysis?.fullName || analysis?.repoName} (${analysis?.primaryLanguage})`,
    ``,
    `=== DETECTED ENVIRONMENT VARIABLES ===`,
    envLines,
    ``,
    `=== FILES TO EXPLAIN ===`,
    fileSummary,
    ``,
    `=== CORE FUNCTIONS TO EXPLAIN IN DEPTH ===`,
    topFns.join("\n\n"),
  ].join("\n");

  if (digest.length > 8800) {
    digest = digest.slice(0, 8800);
  }
  return digest;
}

/**
 * Merges the 2-pass Groq `openai/gpt-oss-120b` deep synthesis with the 100% complete
 * AST inventory of files, functions (including source code), packages, and env vars.
 */
function buildCompleteDetailedReport(pass1, pass2, analysis, envVars, modelsUsed, totalTokens) {
  const safeStr = (v, fb = "") => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const safeArr = (v) => (Array.isArray(v) ? v : []);

  const allFiles = analysis?.files || [];
  const allFunctions = analysis?.functions || [];
  const allPackages = analysis?.packages || [];

  // Map files that import each external package
  const pkgUsedInFiles = new Map();
  for (const file of allFiles) {
    for (const imp of file.imports || []) {
      if (imp.isExternal) {
        const basePkg = imp.source.startsWith("@")
          ? imp.source.split("/").slice(0, 2).join("/")
          : imp.source.split("/")[0];
        if (!pkgUsedInFiles.has(basePkg)) pkgUsedInFiles.set(basePkg, []);
        if (!pkgUsedInFiles.get(basePkg).includes(file.path)) {
          pkgUsedInFiles.get(basePkg).push(file.path);
        }
      }
    }
  }

  // 1. Architecture Deep Dive
  const archRaw = pass1?.systemArchitectureDeepDive || {};
  const subsystemBreakdown = safeArr(archRaw.subsystemBreakdown).map((sub) => ({
    subsystem: safeStr(sub?.subsystem, "Core Subsystem"),
    files: safeArr(sub?.files).filter(Boolean),
    deepExplanation: safeStr(sub?.deepExplanation, ""),
    dataFlowAndState: safeStr(sub?.dataFlowAndState, ""),
  }));

  // 2. Detailed End-to-End Execution Workflows
  const detailedWorkflows = safeArr(pass1?.detailedWorkflows)
    .map((wf) => ({
      workflowName: safeStr(wf?.workflowName, "Execution Workflow"),
      triggerAndEntryFile: safeStr(wf?.triggerAndEntryFile, ""),
      overview: safeStr(wf?.overview, ""),
      steps: safeArr(wf?.steps).map((st, idx) => ({
        stepNumber: Number(st?.stepNumber) || idx + 1,
        file: safeStr(st?.file, ""),
        functionName: safeStr(st?.functionName, ""),
        actionTitle: safeStr(st?.actionTitle, `Step ${idx + 1}`),
        detailedExplanation: safeStr(st?.detailedExplanation, ""),
        dataAndPayload: safeStr(st?.dataAndPayload, ""),
        errorHandlingAndEdgeCases: safeStr(st?.errorHandlingAndEdgeCases, ""),
      })),
    }))
    .filter((w) => w.steps.length > 0);

  // 3. Complete Packages, Versions & Best Alternatives Audit (Merges LLM insights + 100% of AST packages)
  const llmPkgMap = new Map();
  for (const item of safeArr(pass1?.packagesAndLibrariesAudit)) {
    if (item?.name) {
      llmPkgMap.set(String(item.name).toLowerCase(), item);
    }
  }

  const packagesAudit = allPackages.map((astPkg) => {
    const llmItem = llmPkgMap.get(astPkg.name.toLowerCase()) || {};
    const usedFiles = pkgUsedInFiles.get(astPkg.name) || [];
    return {
      name: astPkg.name,
      version: astPkg.version || safeStr(llmItem.version, "latest"),
      type: astPkg.type || "production",
      ecosystem: astPkg.ecosystem || "npm",
      usedInFilesCount: astPkg.usedInFilesCount || usedFiles.length,
      usedInFiles: usedFiles.slice(0, 8),
      purposeInRepo: safeStr(
        llmItem.purposeInRepo,
        `Provides ${astPkg.name} capabilities across ${astPkg.usedInFilesCount || 1} source file(s)${
          usedFiles.length ? ` (including ${usedFiles.slice(0, 3).join(", ")})` : ""
        }.`
      ),
      howItWorksHere: safeStr(
        llmItem.howItWorksHere,
        usedFiles.length
          ? `Imported directly inside ${usedFiles.slice(0, 4).join(", ")} to support module execution.`
          : `Declared in project manifest (${astPkg.version || "latest"}) for runtime/build support.`
      ),
      bestAlternatives: safeStr(
        llmItem.bestAlternatives,
        "Native platform APIs or lightweight ecosystem equivalents"
      ),
      whyCurrentOrWhenToSwitch: safeStr(
        llmItem.whyCurrentOrWhenToSwitch,
        `${astPkg.name} (${astPkg.version || "latest"}) is well-suited for the current ${analysis?.primaryLanguage} stack.`
      ),
    };
  });

  // 4. Complete File-by-File Walkthrough (Merges LLM file explanations + 100% of AST files)
  const llmFileMap = new Map();
  for (const fItem of safeArr(pass2?.fileWalkthroughs)) {
    if (fItem?.path) {
      llmFileMap.set(String(fItem.path).toLowerCase(), fItem);
    }
  }

  const fileWalkthroughs = allFiles.map((astFile) => {
    const llmFile =
      llmFileMap.get(astFile.path.toLowerCase()) ||
      Array.from(llmFileMap.values()).find((x) =>
        astFile.path.toLowerCase().endsWith(String(x.path || "").toLowerCase())
      ) ||
      {};
    const fileFns = allFunctions.filter((fn) => fn.file === astFile.path);
    const extImps = (astFile.imports || []).filter((i) => i.isExternal).map((i) => i.source);
    const intImps = (astFile.imports || []).filter((i) => !i.isExternal).map((i) => i.source);
    const layer = inferFileLayer(astFile.path);

    return {
      path: astFile.path,
      layer,
      language: astFile.language,
      lines: astFile.lines || 0,
      functionCount: fileFns.length,
      definedFunctions: fileFns.map((f) => `${f.name}()`),
      externalImports: extImps,
      internalImports: intImps,
      exports: astFile.exports || [],
      architecturalRole: safeStr(
        llmFile.architecturalRole,
        `${layer} module (${astFile.lines || 0} LOC, ${fileFns.length} function${fileFns.length === 1 ? "" : "s"})`
      ),
      detailedExplanation: safeStr(
        llmFile.detailedExplanation,
        fileFns.length > 0
          ? `Defines ${fileFns.map((f) => `${f.name}()`).join(", ")} in ${astFile.path}. ${
              extImps.length ? `Uses external packages (${extImps.join(", ")}) ` : ""
            }${intImps.length ? `and connects with internal modules (${intImps.join(", ")}).` : ""}`
          : `Configuration or structural module at ${astFile.path} (${astFile.lines || 0} lines).`
      ),
      interactionsWithOtherFiles: safeStr(
        llmFile.interactionsWithOtherFiles,
        intImps.length > 0
          ? `Imports from ${intImps.join(", ")} and exposes ${
              (astFile.exports || []).join(", ") || "module handlers"
            }.`
          : `Standalone or entry-level file within the ${layer} layer.`
      ),
    };
  });

  // 5. Complete Function-by-Function Engineering Reference (100% of AST functions + source code!)
  const llmFnById = new Map();
  const llmFnByName = new Map();
  for (const fnItem of safeArr(pass2?.functionDeepDives)) {
    if (fnItem?.id) llmFnById.set(String(fnItem.id).toLowerCase(), fnItem);
    if (fnItem?.name) {
      const cleanName = String(fnItem.name).replace(/\(\)$/, "").toLowerCase();
      if (!llmFnByName.has(cleanName)) llmFnByName.set(cleanName, fnItem);
    }
  }

  const functionEncyclopedia = allFunctions.map((fn) => {
    const llmFn =
      llmFnById.get(fn.id.toLowerCase()) ||
      llmFnByName.get(fn.name.toLowerCase()) ||
      {};
    const calls = (fn.callsFunctions || []).map((c) => `${c.name}() in ${c.file}`);
    const callers = (fn.calledByFunctions || []).map((c) => `${c.name}() in ${c.file}`);
    const extDeps = (fn.importedDependencies || [])
      .filter((d) => d.isExternal)
      .map((d) => d.source);

    return {
      id: fn.id,
      name: fn.name,
      signature: fn.signature,
      file: fn.file,
      layer: inferFileLayer(fn.file),
      language: fn.language,
      kind: fn.kind,
      isAsync: Boolean(fn.isAsync),
      isExported: Boolean(fn.isExported),
      startLine: fn.startLine,
      endLine: fn.endLine,
      lineCount: fn.lineCount,
      complexity: fn.complexity,
      criticality: fn.criticality,
      criticalityScore: fn.criticalityScore,
      blastRadiusPercent: fn.blastRadiusPercent,
      affectedFilesCount: fn.affectedFilesCount,
      affectedFilesIfChanged: fn.affectedFilesIfChanged || [fn.file],
      callsFunctions: calls,
      calledByFunctions: callers,
      externalDependencies: extDeps,
      purposeSummary: safeStr(
        llmFn.purposeSummary,
        `${fn.isAsync ? "Asynchronous" : "Synchronous"} ${fn.kind || "function"} in ${fn.file} (lines ${fn.startLine}–${fn.endLine}).`
      ),
      stepByStepLogic: safeStr(
        llmFn.stepByStepLogic,
        `${fn.criticalityReason || ""} ${
          calls.length
            ? `Invokes ${calls.slice(0, 5).join(", ")} during execution.`
            : "Executes self-contained module logic directly."
        }${
          callers.length
            ? ` Triggered upstream by ${callers.slice(0, 4).join(", ")}.`
            : ""
        }`.trim()
      ),
      inputsAndOutputs: safeStr(
        llmFn.inputsAndOutputs,
        `Parameters: (${(fn.params || []).join(", ") || "none"}) · Affects ${fn.affectedFilesCount} file(s) (${fn.blastRadiusPercent}% blast radius).`
      ),
      edgeCasesAndNotes: safeStr(
        llmFn.edgeCasesAndNotes,
        `Cyclomatic complexity: ${fn.complexity}. Modifying this function impacts ${(fn.affectedFilesIfChanged || [fn.file]).join(", ")}.`
      ),
      codeSnippet: fn.codeSnippet || fn.signature,
    };
  });

  // 6. Out-of-the-Box Developer Playbook (Env vars, Security/Edge cases, Extension Guide, Interview Q&A)
  const rawPlaybook = pass2?.outOfTheBoxPlaybook || {};
  const llmEnvMap = new Map();
  for (const e of safeArr(rawPlaybook.environmentVariables)) {
    if (e?.name) llmEnvMap.set(String(e.name).toUpperCase(), e);
  }

  const mergedEnvVars = envVars.map((det) => {
    const llmE = llmEnvMap.get(det.name.toUpperCase()) || {};
    return {
      name: det.name,
      usedInFiles: det.files,
      usedInFunctions: det.functions,
      purpose: safeStr(
        llmE.purpose,
        `Configures ${det.name} for ${det.files.join(", ")}.`
      ),
      exampleFormat: safeStr(llmE.exampleFormat, `${det.name}=<your_value>`),
    };
  });
  for (const e of safeArr(rawPlaybook.environmentVariables)) {
    if (e?.name && !mergedEnvVars.some((m) => m.name.toUpperCase() === String(e.name).toUpperCase())) {
      mergedEnvVars.push({
        name: e.name,
        usedInFiles: safeArr(e.usedInFiles),
        usedInFunctions: [],
        purpose: safeStr(e.purpose, "Runtime configuration variable"),
        exampleFormat: safeStr(e.exampleFormat, `${e.name}=...`),
      });
    }
  }

  const topCritFn = allFunctions[0];
  const securityAndEdgeCasesAudit = safeArr(rawPlaybook.securityAndEdgeCasesAudit)
    .map((sec) => ({
      category: safeStr(sec?.category, "Architecture & Security"),
      severity: safeStr(sec?.severity, "MEDIUM").toUpperCase(),
      fileAndFunction: safeStr(sec?.fileAndFunction, ""),
      finding: safeStr(sec?.finding, ""),
      howToFix: safeStr(sec?.howToFix, ""),
    }))
    .filter((s) => s.finding);

  if (securityAndEdgeCasesAudit.length === 0 && topCritFn) {
    securityAndEdgeCasesAudit.push({
      category: "High Blast Radius & Error Boundaries",
      severity: "HIGH",
      fileAndFunction: `${topCritFn.file} :: ${topCritFn.name}()`,
      finding: `${topCritFn.name}() has a ${topCritFn.blastRadiusPercent}% blast radius (${topCritFn.affectedFilesCount} files) and cyclomatic complexity ${topCritFn.complexity}. Unhandled exceptions or contract changes here propagate across ${(topCritFn.affectedFilesIfChanged || []).slice(0, 4).join(", ")}.`,
      howToFix: `Validate inputs at the entry boundary of ${topCritFn.name}(), keep return shapes backward-compatible, and add unit/integration tests before refactoring ${topCritFn.file}.`,
    });
  }

  const extensionPlaybook = safeArr(rawPlaybook.extensionPlaybook)
    .map((ext) => ({
      scenario: safeStr(ext?.scenario, "Adding a New Feature"),
      filesToTouch: safeArr(ext?.filesToTouch).filter(Boolean),
      stepByStepGuide: safeStr(ext?.stepByStepGuide, ""),
    }))
    .filter((e) => e.stepByStepGuide);

  if (extensionPlaybook.length === 0 && allFiles.length > 0) {
    extensionPlaybook.push({
      scenario: `How to Add a New Feature or Endpoint in ${analysis?.repoName || "This Repository"}`,
      filesToTouch: allFiles.slice(0, 4).map((f) => f.path),
      stepByStepGuide: `1. Define or update data models/schemas in the database/config layer. 2. Implement the core handler/service logic alongside existing modules (${allFiles.slice(0, 2).map((f) => f.path).join(", ")}). 3. Wire the route or UI component and verify upstream callers in the AST graph.`,
    });
  }

  const interviewAndVivaQa = safeArr(rawPlaybook.interviewAndVivaQa)
    .map((qa) => ({
      question: safeStr(qa?.question, ""),
      idealAnswer: safeStr(qa?.idealAnswer, ""),
      keyFilesAndFunctions: safeStr(qa?.keyFilesAndFunctions, ""),
    }))
    .filter((q) => q.question && q.idealAnswer);

  if (interviewAndVivaQa.length === 0 && topCritFn) {
    interviewAndVivaQa.push({
      question: `What is the most critical function in ${analysis?.fullName} and what happens if we modify it?`,
      idealAnswer: `${topCritFn.name}() in ${topCritFn.file} (lines ${topCritFn.startLine}–${topCritFn.endLine}) has the highest criticality (${topCritFn.criticalityScore}) and impacts ${topCritFn.affectedFilesCount} files (${topCritFn.blastRadiusPercent}% of the codebase), including ${(topCritFn.affectedFilesIfChanged || []).slice(0, 4).join(", ")}.`,
      keyFilesAndFunctions: `${topCritFn.file}, ${topCritFn.name}()`,
    });
  }

  return {
    type: "DETAILED",
    repoFullName: analysis?.fullName || analysis?.repoName,
    headline: safeStr(
      pass1?.headline,
      `Exhaustive Developer & Codebase Engineering Reference for ${analysis?.fullName}`
    ),
    executiveEngineeringSummary: safeStr(
      pass1?.executiveEngineeringSummary,
      analysis?.description || ""
    ),
    systemArchitectureDeepDive: {
      overview: safeStr(archRaw.overview, ""),
      subsystemBreakdown,
    },
    detailedWorkflows,
    packagesAndLibrariesAudit: packagesAudit,
    fileWalkthroughs,
    functionEncyclopedia,
    outOfTheBoxPlaybook: {
      environmentVariables: mergedEnvVars,
      securityAndEdgeCasesAudit,
      extensionPlaybook,
      interviewAndVivaQa,
    },
    meta: {
      model: modelsUsed,
      tokensUsed: totalTokens,
      generatedAt: new Date().toISOString(),
      totalFilesDocumented: fileWalkthroughs.length,
      totalFunctionsDocumented: functionEncyclopedia.length,
      totalPackagesAudited: packagesAudit.length,
    },
  };
}

/**
 * Generates the exhaustive On-Demand Detailed Developer Report using a 2-pass
 * Groq `openai/gpt-oss-120b` synthesis combined with 100% AST inventory enrichment.
 */
async function generateDetailedProjectReport(analysis) {
  const { apiKey } = getGroqConfig();
  const envVars = extractEnvVariablesFromAnalysis(analysis);

  if (!apiKey) {
    return buildCompleteDetailedReport({}, {}, analysis, envVars, "AST Fallback", 0);
  }

  // =========================================================================
  // PASS 1: Deep System Architecture, Exhaustive Workflows & Packages Audit
  // =========================================================================
  const pass1Digest = buildDetailedPass1Digest(analysis);
  const pass1SystemPrompt = [
    `You are a Principal Staff Engineer writing Part 1 of an exhaustive, textbook-grade Detailed Developer Report for the repository "${analysis?.fullName || analysis?.repoName}".`,
    `TARGET AUDIENCE: New engineers joining the team to maintain/extend this codebase, and students who vibe-coded the project and need to understand every single line, file, workflow, and library so thoroughly that they never even need to open the raw codebase again.`,
    ``,
    `CRITICAL RULES:`,
    `1. ALWAYS CITE EXACT FILE NAMES & FUNCTION NAMES: Whenever explaining architecture or a workflow step, explicitly write the exact file path (e.g. \`server/controllers/userController.js\`) and function name (\`loginUser()\`).`,
    `2. EXHAUSTIVE WORKFLOW TRACES: Trace every major end-to-end workflow in the repository (e.g. Auth/Session flow, Core Feature/API pipeline, DB/State flow, Payment/External integration). Break each workflow into detailed sequential steps showing exact file, function, data payload, DB/API operation, and error/edge-case handling.`,
    `3. COMPLETE PACKAGE & ALTERNATIVES AUDIT: For each package in the digest, explain its exact purpose in this repo, how it is used in specific files, the best modern alternative libraries, and why the current library is good or when a developer should switch.`,
    ``,
    `RETURN VALID JSON MATCHING THIS SCHEMA:`,
    `{`,
    `  "headline": "Comprehensive 1-sentence engineering title for the detailed report",`,
    `  "executiveEngineeringSummary": "2-3 rich paragraphs explaining the complete technical architecture, runtime stack, how frontend/backend/database communicate, and how state & security are managed, citing exact file paths throughout.",`,
    `  "systemArchitectureDeepDive": {`,
    `    "overview": "Detailed narrative of system boundaries, request lifecycle, and state management.",`,
    `    "subsystemBreakdown": [`,
    `      {`,
    `        "subsystem": "Subsystem name (e.g. Client State & Routing, Express API & Auth Middleware, Database & Persistence)",`,
    `        "files": ["exact/file1.js", "exact/file2.js"],`,
    `        "deepExplanation": "Thorough explanation of how these files work together and what logic they encapsulate.",`,
    `        "dataFlowAndState": "How data, props, tokens, or DB records enter and leave this subsystem."`,
    `      }`,
    `    ]`,
    `  },`,
    `  "detailedWorkflows": [`,
    `    {`,
    `      "workflowName": "Name of major workflow (include all major workflows in the repo)",`,
    `      "triggerAndEntryFile": "What triggers this flow and the exact starting file/function",`,
    `      "overview": "Clear summary of the end-to-end execution path",`,
    `      "steps": [`,
    `        {`,
    `          "stepNumber": 1,`,
    `          "file": "exact/file/path.js",`,
    `          "functionName": "exactFunctionName()",`,
    `          "actionTitle": "Short title of this execution step",`,
    `          "detailedExplanation": "Detailed explanation of what the code does at this step, including specific checks, calls, or state updates.",`,
    `          "dataAndPayload": "Exact parameters, request body, headers, or return object at this step",`,
    `          "errorHandlingAndEdgeCases": "How errors, invalid inputs, or failures are handled here"`,
    `        }`,
    `      ]`,
    `    }`,
    `  ],`,
    `  "packagesAndLibrariesAudit": [`,
    `    {`,
    `      "name": "packageName",`,
    `      "version": "version from digest",`,
    `      "purposeInRepo": "What role this library plays in this project",`,
    `      "howItWorksHere": "How and in which exact files it is configured and called",`,
    `      "bestAlternatives": "Top modern alternative packages (e.g. Argon2 vs bcryptjs, Prisma vs Mongoose, Zustand vs Context)",`,
    `      "whyCurrentOrWhenToSwitch": "Engineering trade-off analysis: why the current choice works well here and when to consider switching"`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");

  const pass1Res = await callGroqJsonWithRetry({
    apiKey,
    systemPrompt: pass1SystemPrompt,
    userPrompt: pass1Digest,
    maxCompletionTokens: 4500,
    label: "Detailed Report Pass 1",
  });

  // =========================================================================
  // PASS 2: File-by-File Walkthrough, Function Logic & Out-of-the-Box Playbook
  // =========================================================================
  const pass2Digest = buildDetailedPass2Digest(analysis, envVars);
  const pass2SystemPrompt = [
    `You are a Principal Staff Engineer writing Part 2 of an exhaustive Detailed Developer Report for "${analysis?.fullName || analysis?.repoName}".`,
    `CRITICAL RULES:`,
    `1. COMPLETE ALL 3 TOP-LEVEL KEYS: You MUST populate \`outOfTheBoxPlaybook\`, \`functionDeepDives\`, and \`fileWalkthroughs\` completely. Keep each file and function entry to 2–3 dense, technical sentences citing exact files/symbols so the entire JSON fits cleanly within 4,500 output tokens without truncating.`,
    `2. OUT-OF-THE-BOX DEVELOPER PLAYBOOK FIRST: Provide:`,
    `   - Environment variables & configuration guide`,
    `   - 4-6 Security, edge-case & production hardening findings (citing exact files & functions and how to fix them)`,
    `   - 2-3 Step-by-step Extension Guides ("How to add a new feature/endpoint/page in this repo")`,
    `   - 5-6 high-impact Technical Interview / Viva Questions & Model Answers about this specific codebase.`,
    `3. FUNCTION-BY-FUNCTION & FILE-BY-FILE WALKTHROUGHS: Explain the internal step-by-step logic, inputs/outputs, edge cases, and cross-file connections for the functions and files in the digest.`,
    ``,
    `RETURN VALID JSON MATCHING THIS EXACT SCHEMA ORDER:`,
    `{`,
    `  "outOfTheBoxPlaybook": {`,
    `    "environmentVariables": [`,
    `      { "name": "ENV_VAR_NAME", "usedInFiles": ["file.js"], "purpose": "What it configures", "exampleFormat": "ENV_VAR_NAME=example" }`,
    `    ],`,
    `    "securityAndEdgeCasesAudit": [`,
    `      { "category": "Security | Performance | Error Handling | Validation", "severity": "HIGH | MEDIUM | LOW", "fileAndFunction": "file.js :: fnName()", "finding": "Specific architectural or code risk in this repo", "howToFix": "Concrete senior-engineer fix" }`,
    `    ],`,
    `    "extensionPlaybook": [`,
    `      { "scenario": "e.g. How to Add a New Protected API Endpoint & Connect It to the UI", "filesToTouch": ["file1.js", "file2.js"], "stepByStepGuide": "Numbered step-by-step developer recipe naming exact files and patterns used in this repo" }`,
    `    ],`,
    `    "interviewAndVivaQa": [`,
    `      { "question": "Deep technical question an interviewer or professor might ask about this repo", "idealAnswer": "Clear, thorough model answer citing the exact files, functions, and design decisions", "keyFilesAndFunctions": "file1.js, fnName()" }`,
    `    ]`,
    `  },`,
    `  "functionDeepDives": [`,
    `    {`,
    `      "id": "exact/file/path.js::fnName",`,
    `      "name": "fnName",`,
    `      "purposeSummary": "Clear summary of what this function accomplishes",`,
    `      "stepByStepLogic": "2-4 sentences walking through how the function works internally",`,
    `      "inputsAndOutputs": "What arguments/state it reads and what it returns or mutates",`,
    `      "edgeCasesAndNotes": "Important edge cases, error paths, or blast-radius cautions"`,
    `    }`,
    `  ],`,
    `  "fileWalkthroughs": [`,
    `    {`,
    `      "path": "exact/file/path.js",`,
    `      "architecturalRole": "Concise role title",`,
    `      "detailedExplanation": "2-3 sentences explaining what is inside this file and how its code works",`,
    `      "interactionsWithOtherFiles": "Which exact files import this file or are imported by it"`,
    `    }`,
    `  ]`,
    `}`,
  ].join("\n");

  const pass2Res = await callGroqJsonWithRetry({
    apiKey,
    systemPrompt: pass2SystemPrompt,
    userPrompt: pass2Digest,
    maxCompletionTokens: 5500,
    label: "Detailed Report Pass 2",
  });

  const modelsUsed = Array.from(
    new Set([pass1Res.model, pass2Res.model].filter((m) => m && m !== "AST Fallback"))
  ).join(" + ") || "AST Fallback";
  const totalTokens = (pass1Res.tokens || 0) + (pass2Res.tokens || 0);

  return buildCompleteDetailedReport(
    pass1Res.parsed || {},
    pass2Res.parsed || {},
    analysis,
    envVars,
    modelsUsed,
    totalTokens
  );
}

module.exports = {
  BEST_GROQ_REPORT_MODEL,
  buildBriefReportRepoDigest,
  generateBriefProjectReport,
  generateDetailedProjectReport,
};
