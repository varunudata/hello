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

module.exports = {
  BEST_GROQ_REPORT_MODEL,
  buildBriefReportRepoDigest,
  generateBriefProjectReport,
};
