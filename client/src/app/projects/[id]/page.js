"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../../../components/Logo";
import { API_BASE } from "../../../lib/api";

const NAV_ITEMS = [
  {
    id: "overview",
    num: "01",
    label: "Overview",
    sub: "Files, functions, packages & deps",
    badge: "LIVE",
    active: true,
  },
  {
    id: "graph",
    num: "02",
    label: "Graph Explorer",
    sub: "AST function graph & impact popup",
    badge: "AST",
    active: true,
  },
  {
    id: "ask",
    num: "03",
    label: "Ask Codebase",
    sub: "Graph-aware AST RAG & flow tracing",
    badge: "RAG",
    active: true,
  },
  {
    id: "reports",
    num: "04",
    label: "Project Reports",
    sub: "Brief & deep developer audits",
    badge: "AI",
    active: true,
  },
];

function buildBriefReportMarkdown(report, analysis) {
  if (!report) return "";
  const lines = [
    `# ${analysis?.fullName || report.repoFullName} — Brief Overview Report`,
    `> ${report.headline || ""}`,
    ``,
    `## 1. What This Project Is`,
    report.whatIsProject || "",
    ``,
    `## 2. Problem & Solution`,
    `- **Problem:** ${report.problemAndSolution?.problem || ""}`,
    `- **Solution:** ${report.problemAndSolution?.solution || ""}`,
    ...(report.problemAndSolution?.idealUseCases?.length
      ? [`- **Use Cases:** ${report.problemAndSolution.idealUseCases.join(", ")}`]
      : []),
    ``,
    `## 3. Project Metrics Snapshot`,
    `- Files: ${analysis?.fileCount || 0} | Functions: ${analysis?.functionCount || 0} | Packages: ${analysis?.packageCount || 0} | Lines: ${(analysis?.totalLines || 0).toLocaleString()} | Health Score: ${analysis?.healthScore || 90}%`,
    ``,
    `## 4. Complete Workflow (${report.architectureDesign?.pattern || ""})`,
    report.completeWorkflow?.overview || "",
    ...(report.completeWorkflow?.steps || []).map(
      (s) => `${s.stepNumber}. **[${s.actor}] ${s.title}**: ${s.summary}${s.keyComponent ? ` (\`${s.keyComponent}\`)` : ""}`
    ),
    ``,
    `## 5. Tech Stack Used`,
    ...(report.techStack || []).flatMap((cat) => [
      `### ${cat.category}`,
      ...cat.items.map((it) => `- **${it.name}**: ${it.roleInProject}`),
    ]),
    ``,
    `## 6. Key Files & Modules`,
    ...(report.filesAndModules || []).flatMap((mod) => [
      `### ${mod.folderOrCategory}`,
      ...mod.files.map((f) => `- \`${f.path}\`: ${f.role}`),
    ]),
    ``,
    `## 7. Main Functions Explained Simply`,
    ...(report.mainFunctions || []).map(
      (fn) => `- **\`${fn.name}()\`** (\`${fn.file}\`): ${fn.whatItDoes}`
    ),
  ];

  if (report.keyTakeaways?.length) {
    lines.push(
      ``,
      `## 8. Key Takeaways`,
      ...report.keyTakeaways.map((tk) => `- **[${tk.tag}] ${tk.title}**: ${tk.detail}`)
    );
  }

  return lines.filter((l) => l !== undefined).join("\n");
}

function buildDetailedReportMarkdown(report, analysis) {
  if (!report) return "";
  const lines = [
    `# ${analysis?.fullName || report.repoFullName} — Detailed Developer & Codebase Engineering Report`,
    `> ${report.headline || ""}`,
    ``,
    `## 1. Deep System & Runtime Architecture`,
    report.executiveEngineeringSummary || "",
    ``,
    report.systemArchitectureDeepDive?.overview || "",
    ``,
    ...(report.systemArchitectureDeepDive?.subsystemBreakdown || []).flatMap((sub) => [
      `### ${sub.subsystem} (${(sub.files || []).join(", ")})`,
      sub.deepExplanation || "",
      `- **Data Flow & State:** ${sub.dataFlowAndState || ""}`,
      ``,
    ]),
    `## 2. Exhaustive End-to-End Execution Workflows`,
    ...(report.detailedWorkflows || []).flatMap((wf) => [
      `### ${wf.workflowName}`,
      `- **Trigger / Entry:** ${wf.triggerAndEntryFile}`,
      `- **Overview:** ${wf.overview}`,
      ...(wf.steps || []).map(
        (st) =>
          `${st.stepNumber}. **${st.actionTitle}** (\`${st.file}\` → \`${st.functionName}\`): ${st.detailedExplanation}${
            st.dataAndPayload ? ` | **Payload/State:** ${st.dataAndPayload}` : ""
          }${st.errorHandlingAndEdgeCases ? ` | **Edge Cases:** ${st.errorHandlingAndEdgeCases}` : ""}`
      ),
      ``,
    ]),
    `## 3. Libraries, Dependencies, Versions & Alternatives Audit`,
    ...(report.packagesAndLibrariesAudit || []).flatMap((pkg) => [
      `### ${pkg.name} (\`${pkg.version}\` · ${pkg.type})`,
      `- **Used In Files:** ${(pkg.usedInFiles || []).join(", ") || "Manifest"}`,
      `- **Purpose:** ${pkg.purposeInRepo}`,
      `- **How It Works Here:** ${pkg.howItWorksHere}`,
      `- **Best Alternatives:** ${pkg.bestAlternatives}`,
      `- **Trade-off / When to Switch:** ${pkg.whyCurrentOrWhenToSwitch}`,
      ``,
    ]),
    `## 4. Complete File-by-File Codebase Walkthrough (${(report.fileWalkthroughs || []).length} Files)`,
    ...(report.fileWalkthroughs || []).flatMap((f) => [
      `### \`${f.path}\` (${f.layer} · ${f.lines}L · ${f.functionCount} fns)`,
      `- **Role:** ${f.architecturalRole}`,
      `- **Explanation:** ${f.detailedExplanation}`,
      `- **Connections:** ${f.interactionsWithOtherFiles}`,
      ``,
    ]),
    `## 5. Complete Function-by-Function Engineering Reference (${(report.functionEncyclopedia || []).length} Functions)`,
    ...(report.functionEncyclopedia || []).flatMap((fn) => [
      `### \`${fn.signature}\` — \`${fn.file}\` (L${fn.startLine}–L${fn.endLine})`,
      `- **Criticality:** ${fn.criticality} | **Complexity:** ${fn.complexity} | **Blast Radius:** ${fn.blastRadiusPercent}% (${fn.affectedFilesCount} files)`,
      `- **Purpose:** ${fn.purposeSummary}`,
      `- **Step-by-Step Logic:** ${fn.stepByStepLogic}`,
      `- **Inputs & Outputs:** ${fn.inputsAndOutputs}`,
      `- **Edge Cases & Impact:** ${fn.edgeCasesAndNotes}`,
      ``,
    ]),
    `## 6. Out-of-the-Box Developer Playbook & Interview Q&A`,
    `### Environment Variables`,
    ...(report.outOfTheBoxPlaybook?.environmentVariables || []).map(
      (env) => `- **\`${env.name}\`** (in ${(env.usedInFiles || []).join(", ")}): ${env.purpose} (\`${env.exampleFormat}\`)`
    ),
    ``,
    `### Security & Production Hardening Audit`,
    ...(report.outOfTheBoxPlaybook?.securityAndEdgeCasesAudit || []).map(
      (sec) => `- **[${sec.severity} · ${sec.category}] ${sec.fileAndFunction}**: ${sec.finding} → **Fix:** ${sec.howToFix}`
    ),
    ``,
    `### How to Extend This Codebase`,
    ...(report.outOfTheBoxPlaybook?.extensionPlaybook || []).flatMap((ext) => [
      `#### ${ext.scenario}`,
      `- **Files to Touch:** ${(ext.filesToTouch || []).join(", ")}`,
      ext.stepByStepGuide,
      ``,
    ]),
    `### Technical Interview & Viva Q&A`,
    ...(report.outOfTheBoxPlaybook?.interviewAndVivaQa || []).flatMap((qa, idx) => [
      `#### Q${idx + 1}: ${qa.question}`,
      `- **Key Files/Functions:** ${qa.keyFilesAndFunctions}`,
      qa.idealAnswer,
      ``,
    ]),
  ];

  return lines.join("\n");
}

function renderInlineMarkdown(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/<br\s*\/?>/gi, " · ");
  // Match inline code (`...`), bold (**...**), or single-asterisk italic (*...*)
  const tokenRegex = /(`[^`\n]+`|\*\*[^*\n]+\*\*|(?<!\*)\*[^*\n]+\*(?!\*))/g;
  const tokens = cleaned.split(tokenRegex);

  return tokens.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      const codeStr = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="break-words rounded-[5px] bg-[#efede8] px-1.5 py-[1px] font-mono text-[12.5px] font-medium text-ink"
        >
          {codeStr}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-ink">
          {renderInlineMarkdown(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={idx} className="italic text-ink">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function parseMarkdownTableRow(rowText) {
  const trimmed = rowText.trim();
  const withoutOuterPipes = trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "");
  return withoutOuterPipes.split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(rowText) {
  const trimmed = rowText.trim();
  if (!trimmed.includes("|") || !trimmed.includes("-")) return false;
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(trimmed);
}

function parseNonCodeMarkdownBlocks(segment) {
  const rawLines = String(segment || "").split("\n");
  const blocks = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    // 2. Headings (# to #####)
    const headingMatch = trimmed.match(/^(#{1,5})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    // 3. Markdown Table (consecutive lines containing pipes where a separator row exists or starts/ends with |)
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      trimmed.split("|").length >= 3
    ) {
      const tableLines = [];
      while (
        i < rawLines.length &&
        rawLines[i].trim().startsWith("|") &&
        rawLines[i].trim().includes("|")
      ) {
        tableLines.push(rawLines[i].trim());
        i += 1;
      }
      if (tableLines.length >= 2) {
        const headerCells = parseMarkdownTableRow(tableLines[0]);
        const dataRows = tableLines
          .slice(1)
          .filter((r) => !isMarkdownTableSeparator(r))
          .map(parseMarkdownTableRow);
        blocks.push({
          type: "table",
          headers: headerCells,
          rows: dataRows,
        });
        continue;
      } else {
        // Fallback if single pipe line
        blocks.push({
          type: "paragraph",
          text: tableLines.join(" "),
        });
        continue;
      }
    }

    // 4. Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith(">")) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({
        type: "blockquote",
        text: quoteLines.join("\n"),
      });
      continue;
    }

    // 5. Ordered or Unordered Lists
    if (/^\s*(?:[-*•]|\d+\.)\s+/.test(line)) {
      const items = [];
      while (
        i < rawLines.length &&
        rawLines[i].trim() !== "" &&
        (/^\s*(?:[-*•]|\d+\.)\s+/.test(rawLines[i]) ||
          /^\s{2,}\S/.test(rawLines[i]))
      ) {
        const currentLine = rawLines[i];
        const bulletMatch = currentLine.match(/^(\s*)(?:([-*•])|(\d+)\.)\s+(.*)$/);
        if (bulletMatch) {
          const indent = bulletMatch[1]?.length || 0;
          const orderedNum = bulletMatch[3] || null;
          items.push({
            indentLevel: indent >= 2 ? 1 : 0,
            orderedNum,
            text: bulletMatch[4].trim(),
          });
        } else if (items.length > 0) {
          // Continuation of previous list item
          items[items.length - 1].text += ` ${currentLine.trim()}`;
        }
        i += 1;
      }
      blocks.push({
        type: "list",
        items,
      });
      continue;
    }

    // 6. Standard Paragraph (collect consecutive plain lines)
    const paraLines = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== "" &&
      !/^(#{1,5})\s+/.test(rawLines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(rawLines[i].trim()) &&
      !rawLines[i].trim().startsWith(">") &&
      !(
        rawLines[i].trim().startsWith("|") &&
        rawLines[i].trim().endsWith("|") &&
        rawLines[i].trim().split("|").length >= 3
      ) &&
      !/^\s*(?:[-*•]|\d+\.)\s+/.test(rawLines[i])
    ) {
      paraLines.push(rawLines[i].trim());
      i += 1;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paraLines.join(" "),
      });
    } else {
      i += 1;
    }
  }

  return blocks;
}

function RagMarkdownContent({ content, isStreaming = false }) {
  if (!content) return null;

  // Normalize inline pipe-collapsed tables if the model emitted "| col | col | |---|---|" on a single line
  const normalizedContent = String(content)
    .replace(/\|\s*\|\s*(?=[-:]+\|)/g, "|\n|")
    .replace(/(\|\s*[-:]+\s*\|\s*[-:|\s]*\|)\s*\|/g, "$1\n|");

  // Split closed code blocks and also support an unclosed trailing code block during live streaming
  const segments = normalizedContent.split(/(```[\s\S]*?```|```[\s\S]*$)/g);

  return (
    <div className="space-y-3 text-[14px] leading-[1.7] text-[#2c2a24]">
      {segments.map((segment, segIdx) => {
        if (!segment) return null;

        if (segment.startsWith("```")) {
          const isClosed = segment.endsWith("```") && segment.length >= 6;
          const rawInner = isClosed ? segment.slice(3, -3) : segment.slice(3);
          const lines = rawInner.replace(/^\n/, "").split("\n");
          const firstLine = lines[0]?.trim() || "";
          const hasLang = /^[a-zA-Z0-9_.-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : "code";
          const codeBody = (hasLang ? lines.slice(1) : lines).join("\n").trimEnd();

          return (
            <div
              key={segIdx}
              className="my-3 overflow-hidden rounded-xl border border-line bg-[#f4f2ed]"
            >
              <div className="flex items-center justify-between border-b border-line bg-[#ebe8e1] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                <span>{lang}</span>
                <span>AST snippet</span>
              </div>
              <pre className="overflow-x-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-ink">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        const parsedBlocks = parseNonCodeMarkdownBlocks(segment);

        return parsedBlocks.map((block, bIdx) => {
          const key = `${segIdx}-${bIdx}`;

          if (block.type === "hr") {
            return <hr key={key} className="my-3 border-line" />;
          }

          if (block.type === "heading") {
            if (block.level <= 2) {
              return (
                <h3
                  key={key}
                  className="mt-4 border-b border-line pb-1.5 text-[15px] font-semibold tracking-tight text-ink first:mt-0"
                >
                  {renderInlineMarkdown(block.text)}
                </h3>
              );
            }
            if (block.level === 3) {
              return (
                <h4
                  key={key}
                  className="mt-3.5 text-[14px] font-semibold tracking-tight text-ink first:mt-0"
                >
                  {renderInlineMarkdown(block.text)}
                </h4>
              );
            }
            return (
              <h5
                key={key}
                className="mt-3 font-mono text-xs font-semibold uppercase tracking-wider text-accent first:mt-0"
              >
                {renderInlineMarkdown(block.text)}
              </h5>
            );
          }

          if (block.type === "table") {
            return (
              <div
                key={key}
                className="my-3 overflow-x-auto rounded-lg border border-line-strong bg-surface"
              >
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line-strong bg-sunken/80 font-mono text-[10.5px] uppercase tracking-wider text-ink">
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3.5 py-2.5 font-semibold">
                          {renderInlineMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="transition-colors hover:bg-paper/70"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-3.5 py-2.5 align-top text-[12.5px] leading-relaxed text-ink-soft"
                          >
                            {renderInlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          if (block.type === "blockquote") {
            return (
              <blockquote
                key={key}
                className="my-2.5 rounded-r-lg border-l-2 border-accent bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft"
              >
                {renderInlineMarkdown(block.text)}
              </blockquote>
            );
          }

          if (block.type === "list") {
            return (
              <ul key={key} className="my-2.5 space-y-2">
                {block.items.map((item, lIdx) => (
                  <li
                    key={lIdx}
                    className={`flex items-start gap-2.5 text-[14px] leading-[1.68] ${
                      item.indentLevel > 0 ? "pl-5 text-ink-soft" : "text-[#2c2a24]"
                    }`}
                  >
                    {item.orderedNum ? (
                      <span className="mt-[2px] min-w-[1.25rem] shrink-0 font-mono text-[12px] font-semibold tabular-nums text-accent">
                        {item.orderedNum}.
                      </span>
                    ) : (
                      <span
                        className={`mt-[10px] shrink-0 rounded-full ${
                          item.indentLevel > 0
                            ? "h-1 w-1 bg-muted/60"
                            : "h-1.5 w-1.5 bg-ink/45"
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {renderInlineMarkdown(item.text)}
                    </div>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={key} className="text-[14px] leading-[1.7] text-[#2c2a24]">
              {renderInlineMarkdown(block.text)}
            </p>
          );
        });
      })}

      {isStreaming && (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-accent"
        />
      )}
    </div>
  );
}

function getCriticalityStyles(level) {
  switch (level) {
    case "CRITICAL":
      return {
        bg: "bg-[#fbeae4]",
        border: "border-[#c8502a]",
        text: "text-[#c8502a]",
        dot: "#c8502a",
        fill: "#fbeae4",
        stroke: "#c8502a",
      };
    case "HIGH":
      return {
        bg: "bg-[#f8f0df]",
        border: "border-[#8a5a19]",
        text: "text-[#8a5a19]",
        dot: "#8a5a19",
        fill: "#f8f0df",
        stroke: "#8a5a19",
      };
    case "MODERATE":
      return {
        bg: "bg-[#e7f1ec]",
        border: "border-[#2f6f4e]",
        text: "text-[#2f6f4e]",
        dot: "#2f6f4e",
        fill: "#e7f1ec",
        stroke: "#2f6f4e",
      };
    default:
      return {
        bg: "bg-sunken",
        border: "border-line-strong",
        text: "text-muted",
        dot: "#6c6960",
        fill: "#ffffff",
        stroke: "#d5d3cb",
      };
  }
}

function ProjectWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id;

  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const initialSection = ["overview", "graph", "ask", "reports"].includes(
    initialTabParam
  )
    ? initialTabParam
    : "overview";

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState(initialSection);

  // Graph Explorer states
  const [selectedFnId, setSelectedFnId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("ALL");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [graphNodeLimit, setGraphNodeLimit] = useState(24);

  // Ask Codebase (Section 03) Graph-Aware AST RAG states
  const [askMessages, setAskMessages] = useState([]);
  const [askInput, setAskInput] = useState("");
  const [askingRag, setAskingRag] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [ragMemory, setRagMemory] = useState({
    pinnedFunctionIds: [],
    pinnedFiles: [],
    sessionDigest: "",
  });
  const [expandedContextIds, setExpandedContextIds] = useState({});
  // Project Reports (Section 04) states
  const [reportMode, setReportMode] = useState("brief");
  const [briefReport, setBriefReport] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [briefCached, setBriefCached] = useState(false);
  const [copiedReportMd, setCopiedReportMd] = useState(false);

  const [detailedReport, setDetailedReport] = useState(null);
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [detailedError, setDetailedError] = useState("");
  const [detailedCached, setDetailedCached] = useState(false);
  const [copiedDetailedMd, setCopiedDetailedMd] = useState(false);
  const [detailedFnSearch, setDetailedFnSearch] = useState("");
  const [detailedFnLayer, setDetailedFnLayer] = useState("ALL");
  const [expandedFnSnippets, setExpandedFnSnippets] = useState({});

  const askEndRef = useRef(null);
  const askScrollContainerRef = useRef(null);
  const streamTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let token = null;
    try {
      token = localStorage.getItem("archon_token");
    } catch {
      // ignore
    }
    if (!token) {
      router.replace("/login");
      return;
    }

    async function loadProject() {
      setLoading(true);
      setError("");
      setProject(null);
      setSelectedFnId(null);
      setBriefReport(null);
      setBriefError("");
      setBriefCached(false);
      setDetailedReport(null);
      setDetailedError("");
      setDetailedCached(false);
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (!res.ok || !data.project) {
          setError(data?.message || "Project not found.");
          setLoading(false);
          return;
        }
        setProject(data.project);
        const existingBrief = data.project?.analysisData?.reports?.brief || null;
        if (existingBrief) {
          setBriefReport(existingBrief);
          setBriefCached(true);
        }
        const existingDetailed =
          data.project?.analysisData?.reports?.detailed || null;
        if (existingDetailed) {
          setDetailedReport(existingDetailed);
          setDetailedCached(true);
        }
        const fns = data.project?.analysisData?.functions || [];
        if (fns.length > 0) {
          setSelectedFnId(fns[0].id);
        }
      } catch {
        setError("Unable to load project from AST server.");
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProject();
    }
  }, [projectId, router]);

  const analysis = useMemo(() => {
    if (!project) return null;
    return (
      project.analysisData || {
        repoName: project.name,
        fullName: project.fullName,
        repoUrl: project.repoUrl,
        description: project.description,
        defaultBranch: project.defaultBranch || "main",
        primaryLanguage: project.primaryLanguage || "TypeScript",
        fileCount: project.fileCount || 0,
        functionCount: project.functionCount || 0,
        packageCount: project.packageCount || 0,
        dependencyCount: project.dependencyCount || 0,
        totalLines: project.totalLines || 0,
        astNodeCount: project.astNodeCount || 0,
        healthScore: project.healthScore || 90,
        avgComplexity: 2.4,
        criticalFnCount: 0,
        languages: [],
        packages: [],
        files: [],
        functions: [],
        functionEdges: [],
      }
    );
  }, [project]);

  const allFunctions = useMemo(() => analysis?.functions || [], [analysis]);
  const allEdges = useMemo(() => analysis?.functionEdges || [], [analysis]);

  const filteredFunctions = useMemo(() => {
    return allFunctions.filter((fn) => {
      const matchesCrit =
        criticalityFilter === "ALL" || fn.criticality === criticalityFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        fn.name.toLowerCase().includes(q) ||
        fn.file.toLowerCase().includes(q) ||
        (fn.signature || "").toLowerCase().includes(q);
      return matchesCrit && matchesQuery;
    });
  }, [allFunctions, criticalityFilter, searchQuery]);

  const selectedFunction = useMemo(() => {
    if (!selectedFnId) return null;
    return allFunctions.find((f) => f.id === selectedFnId) || null;
  }, [allFunctions, selectedFnId]);

  // Compute deterministic architectural graph layout for visible functions
  const graphLayout = useMemo(() => {
    if (filteredFunctions.length === 0) {
      return { nodes: [], edges: [], width: 1000, height: 660, totalFiltered: 0 };
    }

    // Cap rendered SVG nodes to keep typography crisp on huge 100-1000+ fn repos,
    // while always including the currently selected function and its direct neighbors
    const visibleSet = new Map();
    for (const fn of filteredFunctions.slice(0, graphNodeLimit)) {
      visibleSet.set(fn.id, fn);
    }
    if (selectedFunction) {
      visibleSet.set(selectedFunction.id, selectedFunction);
      for (const c of selectedFunction.calledByFunctions || []) {
        const match = allFunctions.find((f) => f.id === c.id);
        if (match) visibleSet.set(match.id, match);
      }
      for (const c of selectedFunction.callsFunctions || []) {
        const match = allFunctions.find((f) => f.id === c.id);
        if (match) visibleSet.set(match.id, match);
      }
    }
    const fns = Array.from(visibleSet.values());

    // Group functions into architectural tiers based on callers/callees or folder
    // Tier 0: Entry / Route / Page / Component functions (few callers, many callees)
    // Tier 1: Service / Middleware / Controller orchestration functions
    // Tier 2: Core Library / DB / AST / Utility functions (many callers)
    const tiers = [[], [], []];
    fns.forEach((fn) => {
      const fLower = fn.file.toLowerCase();
      const callers = fn.calledByFunctions?.length || 0;
      const callees = fn.callsFunctions?.length || 0;

      if (
        fLower.includes("route") ||
        fLower.includes("page.") ||
        fLower.includes("components/") ||
        (callers === 0 && callees > 0)
      ) {
        tiers[0].push(fn);
      } else if (
        fLower.includes("lib/") ||
        fLower.includes("logger") ||
        fLower.includes("db.") ||
        fLower.includes("prisma") ||
        callers >= 2
      ) {
        tiers[2].push(fn);
      } else {
        tiers[1].push(fn);
      }
    });

    // Balance tiers if any tier is empty or too crowded
    const flatOrdered = [...tiers[0], ...tiers[1], ...tiers[2]];
    const perRow = selectedFnId ? 3 : 4;
    const rowCount = Math.max(2, Math.ceil(flatOrdered.length / perRow));

    const canvasWidth = perRow * 235 + 110;
    const canvasHeight = Math.max(620, rowCount * 138 + 110);

    const nodePositions = new Map();
    const nodes = flatOrdered.map((fn, idx) => {
      const row = Math.floor(idx / perRow);
      const col = idx % perRow;
      const colsInThisRow = Math.min(
        perRow,
        flatOrdered.length - row * perRow
      );

      const rowWidth = colsInThisRow * 230;
      const startX = (canvasWidth - rowWidth) / 2 + 115;
      const staggerY = col % 2 === 1 ? 14 : -10;

      const x = startX + col * 230;
      const y = 86 + row * 134 + staggerY;

      nodePositions.set(fn.id, { x, y, fn });
      return {
        ...fn,
        x,
        y,
      };
    });

    const visibleEdges = allEdges
      .filter(
        (edge) =>
          nodePositions.has(edge.source) && nodePositions.has(edge.target)
      )
      .map((edge) => {
        const src = nodePositions.get(edge.source);
        const tgt = nodePositions.get(edge.target);
        return {
          ...edge,
          x1: src.x,
          y1: src.y,
          x2: tgt.x,
          y2: tgt.y,
        };
      });

    return {
      nodes,
      edges: visibleEdges,
      width: canvasWidth,
      height: canvasHeight,
      totalFiltered: filteredFunctions.length,
    };
  }, [
    filteredFunctions,
    allFunctions,
    allEdges,
    selectedFnId,
    selectedFunction,
    graphNodeLimit,
  ]);

  function openFunctionInGraph(fnId) {
    setSelectedFnId(fnId);
    setActiveSection("graph");
  }

  const starterPrompts = useMemo(() => {
    const fns = allFunctions || [];
    const routeOrEntry =
      fns.find(
        (f) =>
          f.kind === "route-handler" ||
          /login|auth|checkout|order|analyze|fetch|main|handle/i.test(f.name)
      ) || fns[0];
    const topCritical =
      fns.find((f) => f.criticality === "CRITICAL" && f.id !== routeOrEntry?.id) ||
      fns[1] ||
      fns[0];

    return [
      {
        mode: "FLOW TRACE",
        title: routeOrEntry
          ? `Trace execution flow of ${routeOrEntry.name}()`
          : "Trace main execution flow",
        prompt: routeOrEntry
          ? `Explain the step-by-step execution flow starting from ${routeOrEntry.name}() in ${routeOrEntry.file}`
          : `Explain the primary execution flow in this codebase`,
      },
      {
        mode: "BLAST RADIUS",
        title: topCritical
          ? `Blast radius of ${topCritical.name}()`
          : "Highest impact functions",
        prompt: topCritical
          ? `What is the blast radius and what files will be affected if we modify or remove ${topCritical.name}()?`
          : `Which functions have the highest blast radius and criticality in this project?`,
      },
      {
        mode: "ARCHITECTURE",
        title: `Whole-project workflows & stack`,
        prompt: `Explain the entire project architecture, tech stack, and major workflows of ${
          analysis?.repoName || "this repository"
        }`,
      },
      {
        mode: "PROJECT REPORT",
        title: `Generate detailed developer report`,
        prompt: `Generate a detailed report of this entire project for a developer`,
      },
    ];
  }, [allFunctions, analysis]);

  function scrollToAskBottom(smooth = true, onlyIfNearBottom = false) {
    const container = askScrollContainerRef.current;
    if (container) {
      if (onlyIfNearBottom) {
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom > 160) return;
      }
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    } else {
      askEndRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }

  function stopSequentialStream() {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreamingMsgId(null);
    setStreamedContent("");
    setTimeout(() => scrollToAskBottom(true, true), 40);
  }

  function startSequentialStream(msgId, fullText) {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const text = String(fullText || "");
    if (!text) {
      setStreamingMsgId(null);
      setStreamedContent("");
      return;
    }

    // Split into word chunks (each keeping its trailing whitespace/newlines)
    // and stream 2 words every 25ms (~80 words/sec, ~100 tokens/sec) to match Gemini & ChatGPT
    const wordChunks = text.match(/\S+\s*|\s+/g) || [text];
    const totalChunks = wordChunks.length;
    const wordsPerTick = 2;
    let cursor = 0;

    setStreamingMsgId(msgId);
    setStreamedContent("");

    streamTimerRef.current = setInterval(() => {
      cursor += wordsPerTick;
      if (cursor >= totalChunks) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setStreamingMsgId(null);
        setStreamedContent("");
        setTimeout(() => scrollToAskBottom(true, true), 40);
      } else {
        setStreamedContent(wordChunks.slice(0, cursor).join(""));
        scrollToAskBottom(false, true);
      }
    }, 25);
  }

  async function handleAskSubmit(e, customQuestion = null, memoryOverride = null) {
    if (e) e.preventDefault();
    const q = String(customQuestion ?? askInput).trim();
    if (!q || askingRag) return;

    stopSequentialStream();

    const userMsgId = `usr_${Date.now()}`;
    const userMessage = {
      id: userMsgId,
      role: "user",
      content: q,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const nextHistory = [...askMessages, userMessage];
    setAskMessages(nextHistory);
    if (!customQuestion) setAskInput("");
    setAskingRag(true);

    setTimeout(() => {
      scrollToAskBottom(true);
    }, 50);

    try {
      const token = localStorage.getItem("archon_token") || "";
      const activeMemory = memoryOverride || ragMemory;
      const compactHistory = nextHistory.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${API_BASE}/api/projects/${projectId}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: q,
          history: compactHistory,
          memory: activeMemory,
        }),
      });

      const data = await res.json();
      const assistantMsgId = `ast_${Date.now()}`;

      if (!res.ok) {
        const errText =
          data?.message ||
          "Unable to process that question right now. Please try again.";
        setAskMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: errText,
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        startSequentialStream(assistantMsgId, errText);
      } else {
        if (data.updatedMemory) {
          setRagMemory(data.updatedMemory);
        }
        setAskMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            role: "assistant",
            content: data.answer,
            intent: data.intent,
            redirectAction: data.redirectAction || null,
            telemetry: data.telemetry || null,
            retrievedFunctions: data.retrievedFunctions || [],
            neighborStubs: data.neighborStubs || [],
            callChain: data.callChain || [],
            suggestedFollowUps: data.suggestedFollowUps || [],
            timestamp: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        startSequentialStream(assistantMsgId, data.answer);
      }
    } catch {
      const errId = `err_${Date.now()}`;
      const errMsg =
        "Could not reach the AST RAG backend on port 4000. Verify the server is running.";
      setAskMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: "assistant",
          content: errMsg,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
      startSequentialStream(errId, errMsg);
    } finally {
      setAskingRag(false);
      setTimeout(() => {
        scrollToAskBottom(true);
      }, 80);
    }
  }

  function askAiAboutFunction(fn) {
    if (!fn) return;
    const nextMemory = {
      ...ragMemory,
      pinnedFunctionIds: Array.from(
        new Set([fn.id, ...(ragMemory.pinnedFunctionIds || [])])
      ).slice(0, 6),
      pinnedFiles: Array.from(
        new Set([fn.file, ...(ragMemory.pinnedFiles || [])])
      ).slice(0, 5),
    };
    setRagMemory(nextMemory);
    setActiveSection("ask");
    handleAskSubmit(
      null,
      `Explain how ${fn.name}() works in ${fn.file}, its execution flow, and its blast radius if changed.`,
      nextMemory
    );
  }

  function toggleContextDrawer(msgId) {
    setExpandedContextIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  }

  function removePinnedFunction(fnId) {
    setRagMemory((prev) => ({
      ...prev,
      pinnedFunctionIds: (prev.pinnedFunctionIds || []).filter(
        (id) => id !== fnId
      ),
    }));
  }

  const fetchBriefReport = useCallback(
    async (force = false) => {
      if (!projectId || briefLoading) return;
      setBriefLoading(true);
      setBriefError("");

      try {
        const token = localStorage.getItem("archon_token") || "";
        const res = await fetch(
          `${API_BASE}/api/projects/${projectId}/reports/brief`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ force }),
          }
        );

        const data = await res.json();
        if (!res.ok || !data?.report) {
          setBriefError(
            data?.message ||
              "Unable to generate brief overview report right now."
          );
          return;
        }

        setBriefReport(data.report);
        setBriefCached(Boolean(data.cached));
      } catch {
        setBriefError(
          "Could not reach the AST backend server to generate the brief report."
        );
      } finally {
        setBriefLoading(false);
      }
    },
    [projectId, briefLoading]
  );

  async function handleCopyBriefMarkdown() {
    if (!briefReport) return;
    const md = buildBriefReportMarkdown(briefReport, analysis);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedReportMd(true);
      setTimeout(() => setCopiedReportMd(false), 2200);
    } catch {
      // ignore clipboard restrictions
    }
  }

  async function fetchDetailedReport(force = false) {
    if (!projectId || detailedLoading) return;
    setDetailedLoading(true);
    setDetailedError("");

    try {
      const token = localStorage.getItem("archon_token") || "";
      const res = await fetch(
        `${API_BASE}/api/projects/${projectId}/reports/detailed`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ force }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data?.report) {
        setDetailedError(
          data?.message ||
            "Unable to generate the detailed developer report right now."
        );
        return;
      }

      setDetailedReport(data.report);
      setDetailedCached(Boolean(data.cached));
    } catch {
      setDetailedError(
        "Could not reach the AST backend server to generate the detailed report."
      );
    } finally {
      setDetailedLoading(false);
    }
  }

  async function handleCopyDetailedMarkdown() {
    if (!detailedReport) return;
    const md = buildDetailedReportMarkdown(detailedReport, analysis);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedDetailedMd(true);
      setTimeout(() => setCopiedDetailedMd(false), 2200);
    } catch {
      // ignore clipboard restrictions
    }
  }

  function toggleFnSnippet(fnId) {
    setExpandedFnSnippets((prev) => ({
      ...prev,
      [fnId]: !prev[fnId],
    }));
  }

  useEffect(() => {
    if (
      activeSection !== "reports" ||
      reportMode !== "brief" ||
      !project?.id ||
      briefReport ||
      briefLoading ||
      briefError
    ) {
      return;
    }
    const timerId = setTimeout(() => {
      fetchBriefReport(false);
    }, 0);
    return () => clearTimeout(timerId);
  }, [
    activeSection,
    reportMode,
    project?.id,
    briefReport,
    briefLoading,
    briefError,
    fetchBriefReport,
  ]);

  function handleCanvasMouseDown(e) {
    if (e.target.closest("[data-fn-node]")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }

  function handleCanvasMouseMove(e) {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleCanvasMouseUp() {
    setIsDragging(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-ink">
        <div className="rounded-xl border border-line-strong bg-surface p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-sunken font-mono text-xs font-semibold text-accent">
            AST
          </div>
          <div className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Loading AST Workspace
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Hydrating function call graph & blast radius telemetry…
          </p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-ink">
        <div className="max-w-md rounded-xl border border-line-strong bg-surface p-8 text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-accent">
            Workspace Error
          </div>
          <h1 className="mt-2 text-xl font-semibold text-ink">
            {error || "Project could not be loaded"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Return to your workspace home to connect or select a repository.
          </p>
          <Link
            href="/home"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper hover:bg-ink-soft"
          >
            ← Back to My Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* LEFT SIDEBAR — 4 PROJECT WORKSPACE SECTIONS */}
      <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col justify-between border-r border-line bg-sunken/70 p-5">
        <div>
          {/* Top Brand & Back Link */}
          <div className="flex items-center justify-between border-b border-line pb-4">
            <Link href="/home" aria-label="Back to Workspace Home">
              <Logo />
            </Link>
            <Link
              href="/home"
              className="rounded border border-line-strong bg-surface px-2.5 py-1 font-mono text-[11px] text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              ← Projects
            </Link>
          </div>

          {/* Active Repository Identity Card */}
          <div className="mt-4 rounded-lg border border-line-strong bg-surface p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                AST Indexed
              </span>
              <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {analysis.defaultBranch || "main"}
              </span>
            </div>
            <div
              className="mt-1.5 truncate font-mono text-xs font-semibold text-ink"
              title={analysis.fullName}
            >
              {analysis.fullName}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted">
              <span>{analysis.primaryLanguage}</span>
              <span>{analysis.functionCount} AST fns</span>
            </div>
          </div>

          {/* Left Section Navigation */}
          <div className="mt-6">
            <div className="px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Project Intelligence
            </div>
            <nav className="mt-2 space-y-1.5" aria-label="Project sections">
              {NAV_ITEMS.map((item) => {
                const isCurrent = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      isCurrent
                        ? "border-ink bg-surface text-ink"
                        : "border-transparent bg-transparent text-ink-soft hover:border-line hover:bg-surface/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] ${
                            isCurrent ? " font-semibold text-accent" : "text-muted"
                          }`}
                        >
                          {item.num}
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          item.active
                            ? isCurrent
                              ? "bg-ink text-paper"
                              : "bg-sunken text-ink-soft"
                            : "border border-line bg-paper text-muted"
                        }`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="mt-1 pl-6 text-[11px] leading-snug text-muted">
                      {item.sub}
                    </p>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom AST Engine Status Footer */}
        <div className="rounded-lg border border-line bg-surface p-3.5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
            <span>AST Parser</span>
            <span className="text-ink">@babel/parser</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2 font-mono text-[11px]">
            <div>
              <div className="text-[10px] text-muted">AST Nodes</div>
              <div className="font-semibold text-ink">
                {(analysis.astNodeCount || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted">Health Score</div>
              <div className="font-semibold text-sage">
                {analysis.healthScore || 92}%
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CONTENT AREA */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Context Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-paper px-8">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-accent">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.num} ·{" "}
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
            </span>
            <span className="text-faint">/</span>
            <span className="font-mono text-xs text-muted">
              {analysis.fullName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeSection === "overview" && (
              <button
                type="button"
                onClick={() => setActiveSection("graph")}
                className="inline-flex items-center gap-2 rounded-md bg-ink px-3.5 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
              >
                Open AST Graph Explorer →
              </button>
            )}
            {activeSection === "graph" && (
              <div className="flex items-center gap-2 font-mono text-xs text-muted">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span>
                  Click any function node to inspect its blast radius in the left
                  popup
                </span>
              </div>
            )}
            <a
              href={analysis.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-line-strong bg-surface px-3 py-1.5 font-mono text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              GitHub ↗
            </a>
          </div>
        </header>

        {/* ========================================================= */}
        {/* SECTION 1: OVERVIEW                                       */}
        {/* ========================================================= */}
        {activeSection === "overview" && (
          <main className="mx-auto w-full max-w-6xl space-y-8 p-8">
            {/* Repository Title & Summary Banner */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-line-strong bg-surface p-6 md:flex-row md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded bg-sunken px-2.5 py-1 font-mono text-xs font-medium text-ink">
                    {analysis.primaryLanguage}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    Branch:{" "}
                    <strong className="text-ink">
                      {analysis.defaultBranch}
                    </strong>
                  </span>
                  <span className="font-mono text-xs text-muted">·</span>
                  <span className="font-mono text-xs text-sage">
                    {analysis.astNodeCount?.toLocaleString()} AST nodes verified
                  </span>
                </div>
                <h1 className="mt-2.5 font-mono text-2xl font-semibold tracking-tight text-ink">
                  {analysis.fullName}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
                  {analysis.description}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                <button
                  type="button"
                  onClick={() => setActiveSection("graph")}
                  className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                >
                  Launch Function Graph Explorer →
                </button>
                <span className="font-mono text-[11px] text-muted">
                  {analysis.criticalFnCount || 0} critical blast-radius functions
                  detected
                </span>
              </div>
            </div>

            {/* 6 Architectural KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  01 / Files
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-ink">
                  {analysis.fileCount}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Indexed source modules
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  02 / Functions
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-accent">
                  {analysis.functionCount}
                </div>
                <div className="mt-1 text-xs text-muted">
                  AST-parsed call nodes
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  03 / Packages
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-ink">
                  {analysis.packageCount}
                </div>
                <div className="mt-1 text-xs text-muted">
                  External manifest pkgs
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  04 / Dependencies
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-ink">
                  {analysis.dependencyCount}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Import & call graph links
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  05 / Code Volume
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-ink">
                  {(analysis.totalLines || 0).toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted">
                  Total lines of code
                </div>
              </div>

              <div className="rounded-xl border border-line-strong bg-surface p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  06 / Health Score
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-sage">
                  {analysis.healthScore}%
                </div>
                <div className="mt-1 text-xs text-muted">
                  Avg complexity {analysis.avgComplexity || 2.1}
                </div>
              </div>
            </div>

            {/* Language Distribution & Criticality Summary Row */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Language Breakdown */}
              <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    Language & Syntax Breakdown
                  </div>
                  <span className="font-mono text-xs text-ink">
                    {analysis.languages?.length || 1} language(s)
                  </span>
                </div>

                <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  {(analysis.languages || []).map((lang, idx) => (
                    <div
                      key={lang.name}
                      style={{ width: `${lang.percentage}%` }}
                      className={
                        idx === 0
                          ? "bg-ink"
                          : idx === 1
                          ? "bg-accent"
                          : "bg-sage"
                      }
                      title={`${lang.name}: ${lang.percentage}%`}
                    />
                  ))}
                </div>

                <div className="mt-4 space-y-2.5">
                  {(analysis.languages || []).map((lang, idx) => (
                    <div
                      key={lang.name}
                      className="flex items-center justify-between rounded-lg border border-line bg-paper px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            idx === 0
                              ? "bg-ink"
                              : idx === 1
                              ? "bg-accent"
                              : "bg-sage"
                          }`}
                        />
                        <span className="font-medium text-ink">{lang.name}</span>
                        <span className="font-mono text-[11px] text-muted">
                          ({lang.ext})
                        </span>
                      </div>
                      <div className="font-mono text-xs text-ink-soft">
                        {lang.files} files · {lang.lines.toLocaleString()} LOC (
                        {lang.percentage}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Function Criticality & Blast Radius Overview */}
              <div className="rounded-xl border border-line bg-surface p-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                      AST Impact Distribution
                    </div>
                    <h2 className="mt-1 text-base font-semibold text-ink">
                      Function Criticality & Blast Radius Tiers
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("graph")}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    Inspect in Graph Explorer →
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {["CRITICAL", "HIGH", "MODERATE", "LOW"].map((tier) => {
                    const count = allFunctions.filter(
                      (f) => f.criticality === tier
                    ).length;
                    const st = getCriticalityStyles(tier);
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => {
                          setCriticalityFilter(tier);
                          setActiveSection("graph");
                        }}
                        className="rounded-lg border border-line bg-paper p-3.5 text-left transition-colors hover:border-ink"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${st.bg} ${st.border} ${st.text}`}
                          >
                            {tier}
                          </span>
                          <span className="font-mono text-xs text-muted">→</span>
                        </div>
                        <div className="mt-2 font-mono text-2xl font-semibold text-ink">
                          {count}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          functions in tier
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg border border-line bg-sunken p-3.5 text-xs text-ink-soft">
                  <strong className="font-mono text-[11px] uppercase text-ink">
                    How Criticality is Calculated:
                  </strong>{" "}
                  Our Babel AST engine traverses every{" "}
                  <code className="font-mono text-ink">CallExpression</code> and{" "}
                  <code className="font-mono text-ink">ImportDeclaration</code>{" "}
                  across all {analysis.fileCount} files to compute direct file
                  usage, transitive downstream blast radius if modified/removed,
                  and cyclomatic complexity.
                </div>
              </div>
            </div>

            {/* Top Critical Functions Leaderboard */}
            <div className="rounded-xl border border-line-strong bg-surface">
              <div className="flex flex-col justify-between gap-2 border-b border-line px-6 py-4 sm:flex-row sm:items-center">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    AST Function Impact Leaderboard
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-ink">
                    Most Critical Functions & Blast Radius if Modified or Removed
                  </h2>
                </div>
                <span className="font-mono text-xs text-muted">
                  Click any function to open its Graph Inspector popup
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-sunken/60 font-mono text-[10px] uppercase tracking-wider text-muted">
                      <th className="px-6 py-3">Function & Signature</th>
                      <th className="px-4 py-3">File & Size</th>
                      <th className="px-4 py-3">Direct Files Using</th>
                      <th className="px-4 py-3">
                        If Changed / Removed (Blast Radius)
                      </th>
                      <th className="px-4 py-3">Criticality</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {allFunctions.slice(0, 10).map((fn) => {
                      const st = getCriticalityStyles(fn.criticality);
                      return (
                        <tr
                          key={fn.id}
                          onClick={() => openFunctionInGraph(fn.id)}
                          className="cursor-pointer transition-colors hover:bg-paper"
                        >
                          <td className="px-6 py-3.5">
                            <div className="font-mono text-xs font-semibold text-ink">
                              {fn.name}()
                            </div>
                            <div className="mt-0.5 max-w-xs truncate font-mono text-[11px] text-muted">
                              {fn.signature}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <div className="text-ink-soft">{fn.file}</div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              L{fn.startLine}–L{fn.endLine} · {fn.lineCount} lines
                              ({fn.sizeBytes} B)
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono">
                            <span className="font-semibold text-ink">
                              {fn.usedByFilesCount}
                            </span>{" "}
                            <span className="text-muted">
                              {fn.usedByFilesCount === 1 ? "file" : "files"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-semibold text-ink">
                                {fn.affectedFilesCount} / {analysis.fileCount}{" "}
                                files
                              </span>
                              <span className="rounded bg-sunken px-1.5 py-0.5 text-[10px] text-accent">
                                {fn.blastRadiusPercent}% of repo
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full bg-sunken">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${fn.blastRadiusPercent}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${st.bg} ${st.border} ${st.text}`}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: st.dot }}
                              />
                              {fn.criticality} ({fn.criticalityScore})
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono">
                            <span className="text-accent hover:underline">
                              Inspect →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Packages & Dependencies Registry + Source Files Table */}
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Packages & Dependencies */}
              <div className="rounded-xl border border-line bg-surface lg:col-span-5">
                <div className="border-b border-line px-6 py-4">
                  <div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    Manifest & AST Imports
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-ink">
                    Packages & Versions ({analysis.packages?.length || 0})
                  </h2>
                </div>
                <div className="max-h-96 divide-y divide-line overflow-y-auto px-6">
                  {(analysis.packages || []).map((pkg) => (
                    <div
                      key={pkg.name}
                      className="flex items-center justify-between py-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-ink">
                            {pkg.name}
                          </span>
                          <span className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[10px] text-accent">
                            {pkg.version}
                          </span>
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase text-muted">
                          {pkg.ecosystem} · {pkg.type}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[11px] text-ink-soft">
                        {pkg.usedInFilesCount > 0 ? (
                          <span>
                            Imported in{" "}
                            <strong className="text-ink">
                              {pkg.usedInFilesCount}
                            </strong>{" "}
                            {pkg.usedInFilesCount === 1 ? "file" : "files"}
                          </span>
                        ) : (
                          <span className="text-muted">Manifest dependency</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indexed Source Files Inventory */}
              <div className="rounded-xl border border-line bg-surface lg:col-span-7">
                <div className="border-b border-line px-6 py-4">
                  <div className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                    Repository File Tree
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-ink">
                    Indexed Source Files ({analysis.files?.length || 0})
                  </h2>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line bg-sunken/50 font-mono text-[10px] uppercase text-muted">
                        <th className="px-5 py-2.5">File Path</th>
                        <th className="px-3 py-2.5">Language</th>
                        <th className="px-3 py-2.5">LOC / Size</th>
                        <th className="px-3 py-2.5">AST Fns</th>
                        <th className="px-5 py-2.5 text-right">Imports</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {(analysis.files || []).map((file) => (
                        <tr key={file.path} className="hover:bg-paper">
                          <td className="px-5 py-3 text-ink">{file.path}</td>
                          <td className="px-3 py-3 text-[11px] text-muted">
                            {file.language}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-ink-soft">
                            {file.lines}L · {(file.sizeBytes / 1024).toFixed(1)}{" "}
                            KB
                          </td>
                          <td className="px-3 py-3 font-semibold text-accent">
                            {file.functionCount}
                          </td>
                          <td className="px-5 py-3 text-right text-[11px] text-muted">
                            {file.imports?.length || 0} deps
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* SECTION 2: GRAPH EXPLORER (WITH LEFT FUNCTION POPUP)       */}
        {/* ========================================================= */}
        {activeSection === "graph" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Graph Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search function input */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter functions or files…"
                    className="h-8 w-56 rounded-md border border-line-strong bg-paper px-3 font-mono text-xs text-ink placeholder:text-faint focus:border-ink focus:outline-none"
                  />
                </div>

                {/* Criticality Filter Pills */}
                <div className="flex items-center gap-1 rounded-md border border-line bg-paper p-0.5 font-mono text-[11px]">
                  {["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCriticalityFilter(lvl)}
                      className={`rounded px-2.5 py-1 transition-colors ${
                        criticalityFilter === lvl
                          ? "bg-ink font-medium text-paper"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {/* Quick Function Selector Dropdown for rapid access */}
                <select
                  aria-label="Select AST Function"
                  value={selectedFnId || ""}
                  onChange={(e) => setSelectedFnId(e.target.value || null)}
                  className="h-8 rounded-md border border-line-strong bg-paper px-2.5 font-mono text-xs text-ink focus:border-ink focus:outline-none"
                >
                  <option value="">— Select function to inspect —</option>
                  {allFunctions.map((fn) => (
                    <option key={fn.id} value={fn.id}>
                      [{fn.criticality}] {fn.name}() — {fn.file}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom & Reset Controls */}
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-3 pr-2 font-mono text-[11px] text-muted xl:flex">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#c8502a]" />
                    Critical
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#8a5a19]" />
                    High
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#2f6f4e]" />
                    Moderate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#6c6960]" />
                    Low
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))
                  }
                  className="rounded border border-line-strong bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-ink"
                  title="Zoom Out"
                >
                  −
                </button>
                <span className="w-12 text-center font-mono text-xs text-muted">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))
                  }
                  className="rounded border border-line-strong bg-paper px-2.5 py-1 font-mono text-xs text-ink hover:border-ink"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  className="rounded border border-line-strong bg-paper px-2.5 py-1 font-mono text-[11px] text-muted hover:border-ink hover:text-ink"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Main Split / Overlay Graph Workspace: LEFT POPUP + INTERACTIVE AST GRAPH */}
            <div className="relative flex flex-1 overflow-hidden bg-paper">
              {/* ================================================================= */}
              {/* LEFT FUNCTION IMPACT INSPECTOR POPUP                              */}
              {/* Appears on the left side when any function node is clicked        */}
              {/* ================================================================= */}
              <AnimatePresence>
                {selectedFunction && (
                  <motion.aside
                    key={selectedFunction.id}
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -30, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    data-testid="function-inspector-popup"
                    className="z-10 flex h-[calc(100vh-7.5rem)] w-[430px] shrink-0 flex-col border-r border-line-strong bg-surface shadow-sm"
                  >
                    {/* Popup Header */}
                    <div className="border-b border-line bg-sunken/60 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const st = getCriticalityStyles(
                              selectedFunction.criticality
                            );
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${st.bg} ${st.border} ${st.text}`}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: st.dot }}
                                />
                                {selectedFunction.criticality} CRITICALITY ·{" "}
                                {selectedFunction.criticalityScore}/100
                              </span>
                            );
                          })()}
                          <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[10px] text-muted">
                            {selectedFunction.language}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedFnId(null)}
                          aria-label="Close function inspector popup"
                          className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs text-muted hover:border-ink hover:text-ink"
                        >
                          ✕
                        </button>
                      </div>

                      <h2 className="mt-3 font-mono text-lg font-semibold text-ink">
                        {selectedFunction.name}()
                      </h2>
                      <div className="mt-1 break-all rounded border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] text-ink-soft">
                        {selectedFunction.signature}
                      </div>
                      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted">
                        <span>{selectedFunction.file}</span>
                        <span>
                          Lines {selectedFunction.startLine}–
                          {selectedFunction.endLine}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => askAiAboutFunction(selectedFunction)}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 py-2 font-mono text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                      >
                        <span>Ask AI about {selectedFunction.name}()</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>

                    {/* Scrollable Inspector Body */}
                    <div className="flex-1 space-y-5 overflow-y-auto p-5">
                      {/* 1. PROJECT IMPACT & BLAST RADIUS SECTION (Primary Requirement) */}
                      <div className="rounded-xl border border-[#c8502a]/40 bg-[#fbeae4]/35 p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent">
                            Project Impact & Blast Radius
                          </span>
                          <span className="font-mono text-xs font-semibold text-ink">
                            {selectedFunction.blastRadiusPercent}% of project
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                          {selectedFunction.criticalityReason}
                        </p>

                        {/* Impact Metrics Comparison */}
                        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                          <div className="rounded-lg border border-line-strong bg-surface p-3">
                            <div className="font-mono text-[10px] uppercase text-muted">
                              Files Using Function
                            </div>
                            <div className="mt-1 font-mono text-xl font-semibold text-ink">
                              {selectedFunction.usedByFilesCount}{" "}
                              <span className="text-xs font-normal text-muted">
                                {selectedFunction.usedByFilesCount === 1
                                  ? "file"
                                  : "files"}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              Direct callers & importers
                            </div>
                          </div>

                          <div className="rounded-lg border border-line-strong bg-surface p-3">
                            <div className="font-mono text-[10px] uppercase text-accent">
                              If Changed / Removed
                            </div>
                            <div className="mt-1 font-mono text-xl font-semibold text-accent">
                              {selectedFunction.affectedFilesCount}{" "}
                              <span className="text-xs font-normal text-ink-soft">
                                / {analysis.fileCount} files
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              Will be affected across repo
                            </div>
                          </div>
                        </div>

                        {/* Blast Radius Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between font-mono text-[10px] text-muted">
                            <span>Transitive Repository Blast Radius</span>
                            <span className="font-semibold text-accent">
                              {selectedFunction.affectedFilesCount} files (
                              {selectedFunction.blastRadiusPercent}%)
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface">
                            <div
                              className="h-full bg-accent transition-all duration-300"
                              style={{
                                width: `${selectedFunction.blastRadiusPercent}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Affected Files List if Modified or Removed */}
                        <div className="mt-3.5 border-t border-line pt-3">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                            Files affected if {selectedFunction.name}() is
                            changed or removed (
                            {selectedFunction.affectedFilesIfChanged?.length ||
                              0}
                            ):
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(
                              selectedFunction.affectedFilesIfChanged || []
                            ).map((filePath) => (
                              <span
                                key={filePath}
                                className="rounded border border-line-strong bg-surface px-2 py-0.5 font-mono text-[11px] text-ink"
                              >
                                {filePath}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 2. FUNCTION SIZE, LANGUAGE & AST TELEMETRY */}
                      <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                          Function Size, Language & AST Metrics
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2.5">
                          <div className="rounded-lg border border-line bg-paper p-3">
                            <div className="font-mono text-[10px] uppercase text-muted">
                              Size
                            </div>
                            <div className="mt-1 font-mono text-sm font-semibold text-ink">
                              {selectedFunction.lineCount} lines
                            </div>
                            <div className="font-mono text-[10px] text-muted">
                              {selectedFunction.sizeBytes} bytes
                            </div>
                          </div>

                          <div className="rounded-lg border border-line bg-paper p-3">
                            <div className="font-mono text-[10px] uppercase text-muted">
                              Language
                            </div>
                            <div className="mt-1 font-mono text-sm font-semibold text-ink">
                              {selectedFunction.language}
                            </div>
                            <div className="font-mono text-[10px] text-muted">
                              {selectedFunction.isAsync ? "async" : "sync"} ·{" "}
                              {selectedFunction.isExported
                                ? "exported"
                                : "local"}
                            </div>
                          </div>

                          <div className="rounded-lg border border-line bg-paper p-3">
                            <div className="font-mono text-[10px] uppercase text-muted">
                              Complexity
                            </div>
                            <div className="mt-1 font-mono text-sm font-semibold text-ink">
                              {selectedFunction.complexity} branches
                            </div>
                            <div className="font-mono text-[10px] text-muted">
                              {selectedFunction.astNodes} AST nodes
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. IMPORTED DEPENDENCIES */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                            Imported Dependencies (
                            {selectedFunction.importedDependencies?.length || 0}
                            )
                          </span>
                          <span className="font-mono text-[10px] text-muted">
                            AST ImportDeclarations
                          </span>
                        </div>

                        {selectedFunction.importedDependencies?.length > 0 ? (
                          <div className="mt-2 space-y-1.5">
                            {selectedFunction.importedDependencies.map(
                              (dep, i) => (
                                <div
                                  key={`${dep.source}-${i}`}
                                  className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-semibold text-ink">
                                      {dep.source}
                                    </div>
                                    {dep.specifiers?.length > 0 && (
                                      <div className="truncate text-[10px] text-muted">
                                        imports:{" "}
                                        {dep.specifiers.join(", ")}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase ${
                                      dep.isExternal
                                        ? "border border-line-strong bg-surface text-accent"
                                        : "bg-sunken text-ink-soft"
                                    }`}
                                  >
                                    {dep.isExternal ? "External Pkg" : "Module"}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 rounded-lg border border-line bg-paper p-3 font-mono text-xs text-muted">
                            Zero external imports required by this module.
                          </div>
                        )}
                      </div>

                      {/* 4. CALL GRAPH CONNECTIONS (UPSTREAM CALLERS & DOWNSTREAM CALLEES) */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-line bg-paper p-3">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Called By (
                            {selectedFunction.calledByFunctions?.length || 0})
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedFunction.calledByFunctions?.length > 0 ? (
                              selectedFunction.calledByFunctions.map((caller) => (
                                <button
                                  key={caller.id}
                                  type="button"
                                  onClick={() => setSelectedFnId(caller.id)}
                                  className="rounded border border-line-strong bg-surface px-2 py-1 font-mono text-[11px] text-ink transition-colors hover:border-accent hover:text-accent"
                                >
                                  ↖ {caller.name}()
                                </button>
                              ))
                            ) : (
                              <span className="font-mono text-[11px] text-muted">
                                Entry point (no upstream callers)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-line bg-paper p-3">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Calls ({selectedFunction.callsFunctions?.length || 0}
                            )
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedFunction.callsFunctions?.length > 0 ? (
                              selectedFunction.callsFunctions.map((callee) => (
                                <button
                                  key={callee.id}
                                  type="button"
                                  onClick={() => setSelectedFnId(callee.id)}
                                  className="rounded border border-line-strong bg-surface px-2 py-1 font-mono text-[11px] text-ink transition-colors hover:border-accent hover:text-accent"
                                >
                                  ↘ {callee.name}()
                                </button>
                              ))
                            ) : (
                              <span className="font-mono text-[11px] text-muted">
                                Leaf function (no internal calls)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 5. EXTRACTED AST SOURCE SNIPPET */}
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                            AST Source Definition
                          </span>
                          <span className="font-mono text-[10px] text-muted">
                            {selectedFunction.file}:{selectedFunction.startLine}
                          </span>
                        </div>
                        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-sunken p-3.5 font-mono text-[11px] leading-relaxed text-ink">
                          <code>{selectedFunction.codeSnippet}</code>
                        </pre>
                      </div>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              {/* ================================================================= */}
              {/* INTERACTIVE AST FUNCTION GRAPH CANVAS                             */}
              {/* ================================================================= */}
              <div
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className={`relative flex-1 overflow-auto bg-paper ${
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{
                  backgroundImage:
                    "radial-gradient(#d5d3cb 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                {!selectedFunction && (
                  <div className="pointer-events-none absolute left-5 top-5 z-10 rounded-lg border border-line-strong bg-surface/95 px-4 py-2.5 shadow-sm">
                    <div className="font-mono text-xs font-medium text-ink">
                      Click any AST function node in the graph
                    </div>
                    <div className="text-[11px] text-muted">
                      Opens the left function inspector popup with blast radius &
                      dependency impact.
                    </div>
                  </div>
                )}

                {graphLayout.totalFiltered > graphLayout.nodes.length && (
                  <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2.5 rounded-lg border border-line-strong bg-surface/95 px-3.5 py-2 shadow-sm">
                    <span className="font-mono text-[11px] text-muted">
                      Showing{" "}
                      <strong className="text-ink">
                        {graphLayout.nodes.length}
                      </strong>{" "}
                      of{" "}
                      <strong className="text-ink">
                        {graphLayout.totalFiltered}
                      </strong>{" "}
                      AST functions
                    </span>
                    <button
                      type="button"
                      onClick={() => setGraphNodeLimit((n) => n + 24)}
                      className="rounded border border-line-strong bg-paper px-2.5 py-1 font-mono text-[11px] font-medium text-ink transition-colors hover:border-ink hover:text-accent"
                    >
                      + Show 24 more
                    </button>
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="h-full w-full select-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center center",
                    transition: isDragging ? "none" : "transform 0.15s ease-out",
                  }}
                >
                  <defs>
                    <marker
                      id="ast-arrow"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#9c988e" />
                    </marker>
                    <marker
                      id="ast-arrow-active"
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6.5"
                      markerHeight="6.5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#c8502a" />
                    </marker>
                  </defs>

                  {/* Render Call Graph Edges */}
                  {graphLayout.edges.map((edge) => {
                    const isConnectedToSelected =
                      selectedFnId &&
                      (edge.source === selectedFnId ||
                        edge.target === selectedFnId);

                    const dx = edge.x2 - edge.x1;
                    const dy = edge.y2 - edge.y1;
                    const midX = (edge.x1 + edge.x2) / 2;
                    const midY = (edge.y1 + edge.y2) / 2 - Math.abs(dx) * 0.08;

                    // Shorten start/end so arrows land cleanly at node borders
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const startX = edge.x1 + (dx / dist) * 55;
                    const startY = edge.y1 + (dy / dist) * 28;
                    const endX = edge.x2 - (dx / dist) * 65;
                    const endY = edge.y2 - (dy / dist) * 32;

                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                          fill="none"
                          stroke={isConnectedToSelected ? "#c8502a" : "#c8c5bc"}
                          strokeWidth={isConnectedToSelected ? "2.2" : "1.25"}
                          strokeDasharray={
                            isConnectedToSelected ? "none" : "4 3"
                          }
                          markerEnd={
                            isConnectedToSelected
                              ? "url(#ast-arrow-active)"
                              : "url(#ast-arrow)"
                          }
                          opacity={
                            !selectedFnId || isConnectedToSelected ? 1 : 0.35
                          }
                        />
                      </g>
                    );
                  })}

                  {/* Render AST Function Nodes */}
                  {graphLayout.nodes.map((node) => {
                    const isSelected = node.id === selectedFnId;
                    const isNeighbor =
                      selectedFunction &&
                      (selectedFunction.callsFunctions?.some(
                        (c) => c.id === node.id
                      ) ||
                        selectedFunction.calledByFunctions?.some(
                          (c) => c.id === node.id
                        ));

                    const st = getCriticalityStyles(node.criticality);
                    const boxW = 192;
                    const boxH = 74;

                    return (
                      <g
                        key={node.id}
                        data-fn-node={node.name}
                        transform={`translate(${node.x - boxW / 2}, ${
                          node.y - boxH / 2
                        })`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFnId(node.id);
                        }}
                        className="cursor-pointer"
                        opacity={
                          !selectedFnId || isSelected || isNeighbor ? 1 : 0.65
                        }
                      >
                        {/* Outer pulse ring for selected node */}
                        {isSelected && (
                          <rect
                            x="-5"
                            y="-5"
                            width={boxW + 10}
                            height={boxH + 10}
                            rx="12"
                            fill="none"
                            stroke="#c8502a"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Node Card Background */}
                        <rect
                          width={boxW}
                          height={boxH}
                          rx="8"
                          fill={isSelected ? "#fafaf8" : "#ffffff"}
                          stroke={isSelected ? "#1a1915" : st.stroke}
                          strokeWidth={isSelected ? "2.2" : "1.4"}
                        />

                        {/* Top Criticality Strip */}
                        <circle
                          cx="14"
                          cy="16"
                          r="4"
                          fill={st.dot}
                        />
                        <text
                          x="24"
                          y="19"
                          fill={st.dot}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="600"
                        >
                          {node.criticality} · {node.blastRadiusPercent}% BLAST
                        </text>

                        {/* Function Name */}
                        <text
                          x="12"
                          y="39"
                          fill="#1a1915"
                          fontSize="12"
                          fontFamily="monospace"
                          fontWeight="700"
                        >
                          {node.name.length > 20
                            ? node.name.slice(0, 19) + "…"
                            : node.name}
                          ()
                        </text>

                        {/* File & Size Sub-label */}
                        <text
                          x="12"
                          y="57"
                          fill="#6c6960"
                          fontSize="10"
                          fontFamily="monospace"
                        >
                          {node.file.split("/").pop()} · {node.lineCount}L ·{" "}
                          {node.affectedFilesCount}f impact
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 3: ASK CODEBASE (VIEWPORT-LOCKED LLM WORKSPACE)   */}
        {/* ========================================================= */}
        {activeSection === "ask" && (
          <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-paper">
            {/* 1. FIXED TOP STATUS & MEMORY BAR */}
            <div className="shrink-0 border-b border-line bg-surface px-6 py-2.5">
              <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    GROQ LPU · AST RAG
                  </span>
                  <h1 className="text-sm font-semibold tracking-tight text-ink">
                    Ask {analysis.fullName}
                  </h1>
                  <span className="rounded border border-line bg-paper px-2 py-0.5 font-mono text-[10px] text-muted">
                    {analysis.functionCount} AST fns · {analysis.fileCount} files
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Active Pinned Memory Pills */}
                  {ragMemory.pinnedFunctionIds?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                        Pinned:
                      </span>
                      {ragMemory.pinnedFunctionIds.slice(0, 3).map((fnId) => {
                        const fnObj = allFunctions.find((f) => f.id === fnId);
                        const shortLabel = fnObj
                          ? `${fnObj.name}()`
                          : `${fnId.split("::").pop()}()`;
                        return (
                          <span
                            key={fnId}
                            className="inline-flex items-center gap-1 rounded border border-line-strong bg-paper px-2 py-0.5 font-mono text-[10px] text-ink"
                          >
                            <button
                              type="button"
                              onClick={() => openFunctionInGraph(fnId)}
                              className="hover:text-accent"
                              title="Inspect function in Graph Explorer"
                            >
                              {shortLabel}
                            </button>
                            <button
                              type="button"
                              onClick={() => removePinnedFunction(fnId)}
                              className="text-faint hover:text-accent"
                              aria-label={`Unpin ${shortLabel}`}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {askMessages.some((m) => m.telemetry) && (
                    <span className="rounded border border-[#c8502a]/40 bg-[#fbeae4]/45 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                      {(() => {
                        const withTel = askMessages.filter(
                          (m) => m.telemetry?.tokensSavedPercent
                        );
                        if (!withTel.length) return "92% tokens saved";
                        const avg =
                          withTel.reduce(
                            (acc, m) => acc + m.telemetry.tokensSavedPercent,
                            0
                          ) / withTel.length;
                        return `${avg.toFixed(1)}% avg tokens saved`;
                      })()}
                    </span>
                  )}

                  {askMessages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        stopSequentialStream();
                        setAskMessages([]);
                        setRagMemory({
                          pinnedFunctionIds: [],
                          pinnedFiles: [],
                          sessionDigest: "",
                        });
                        setExpandedContextIds({});
                      }}
                      className="rounded border border-line-strong bg-paper px-2.5 py-1 font-mono text-[10px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      Clear chat
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. SCROLLABLE MIDDLE LLM MESSAGE VIEWPORT */}
            <div
              ref={askScrollContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4"
            >
              {askMessages.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center py-2">
                  {/* Compact LLM Welcome Header */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      Section 03 · Graph-Aware AST RAG Assistant
                    </div>
                    <h2 className="mt-2.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                      What would you like to trace in {analysis.repoName}?
                    </h2>
                    <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
                      Archon never dumps all {analysis.fileCount} files into the
                      prompt. It filters stop words, locates the exact AST
                      functions and 1-hop neighbors linked to your question, and
                      streams a grounded explanation via Groq LLM.
                    </p>
                  </div>

                  {/* 2x2 Starter Prompt Cards */}
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {starterPrompts.map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        disabled={askingRag}
                        onClick={() => handleAskSubmit(null, item.prompt)}
                        className="group flex flex-col justify-between rounded-xl border border-line-strong bg-surface p-3.5 text-left transition-all hover:border-ink hover:bg-paper"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-accent">
                              {item.mode}
                            </span>
                            <span className="font-mono text-xs text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
                              →
                            </span>
                          </div>
                          <div className="mt-1.5 font-mono text-xs font-semibold text-ink">
                            {item.title}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                            “{item.prompt}”
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Compact 3-Column RAG Pipeline Strip */}
                  <div className="mt-4 rounded-xl border border-line bg-surface/80 p-3.5">
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
                      4-Stage AST Retrieval Pipeline (Stop-Words → SLM Router → Groq LLM)
                    </div>
                    <div className="mt-2 grid gap-3 text-[11px] text-muted sm:grid-cols-3">
                      <div>
                        <strong className="font-mono text-[10.5px] text-ink">
                          01 · Keyword & Stop-Word Filter
                        </strong>
                        <p className="mt-0.5 leading-relaxed">
                          Strips stop words and matches keywords against AST
                          functions, files, and call-graph neighbors.
                        </p>
                      </div>
                      <div>
                        <strong className="font-mono text-[10.5px] text-ink">
                          02 · SLM Fallback Router
                        </strong>
                        <p className="mt-0.5 leading-relaxed">
                          If keywords don&apos;t match directly, Groq SLM (
                          <code className="font-mono">gpt-oss-20b</code>) selects
                          the linked files & functions.
                        </p>
                      </div>
                      <div>
                        <strong className="font-mono text-[10.5px] text-ink">
                          03 · Groq LLM & Report Guard
                        </strong>
                        <p className="mt-0.5 leading-relaxed">
                          Streams explanation from{" "}
                          <code className="font-mono">gpt-oss-120b</code> or
                          redirects full-repo report queries to Section 04.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-6 py-2 pb-6">
                  {askMessages.map((msg) => {
                    if (msg.role === "user") {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-lg rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-paper shadow-sm">
                            <p className="text-[14px] leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const isContextOpen = Boolean(expandedContextIds[msg.id]);
                    const isThisMsgStreaming = streamingMsgId === msg.id;
                    const displayedMarkdown = isThisMsgStreaming
                      ? streamedContent
                      : msg.content;
                    const cleanCallChain = (msg.callChain || []).filter(
                      (step) =>
                        !String(step.file || "")
                          .toLowerCase()
                          .includes("/components/ui/") &&
                        !/^(button|input|label|checkbox|card\w*|table\w*|tabs\w*|select\w*|textarea|badge|dialog\w*|cn)$/i.test(
                          step.name || ""
                        )
                    );

                    return (
                      <div
                        key={msg.id}
                        className="space-y-3 border-b border-line/70 pb-6 last:border-b-0"
                      >
                        {/* Minimal Single-Row Assistant Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink font-mono text-[10px] font-bold text-paper">
                              A
                            </span>
                            <span className="text-xs font-semibold text-ink">
                              Archon
                            </span>
                            {msg.telemetry && (
                              <span className="truncate font-mono text-[11px] text-muted">
                                ·{" "}
                                {msg.telemetry.functionsRetrieved > 0
                                  ? `${msg.telemetry.functionsRetrieved} AST ${
                                      msg.telemetry.functionsRetrieved === 1
                                        ? "fn"
                                        : "fns"
                                    }`
                                  : msg.telemetry.intentLabel || msg.intent}
                                {msg.telemetry.tokensSent > 0 && (
                                  <>
                                    {" · "}
                                    <span className="text-accent">
                                      {msg.telemetry.tokensSavedPercent}% tokens saved
                                    </span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {isThisMsgStreaming && (
                              <button
                                type="button"
                                onClick={stopSequentialStream}
                                className="rounded-md px-2 py-1 font-mono text-[11px] font-medium text-accent transition-colors hover:bg-[#fbeae4]/50"
                              >
                                Skip ⏭
                              </button>
                            )}

                            {msg.telemetry &&
                              (msg.retrievedFunctions?.length > 0 ||
                                msg.neighborStubs?.length > 0) && (
                                <button
                                  type="button"
                                  onClick={() => toggleContextDrawer(msg.id)}
                                  className="rounded-md px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-sunken hover:text-ink"
                                >
                                  {isContextOpen
                                    ? "Hide AST ▴"
                                    : `AST Context (${
                                        msg.retrievedFunctions?.length || 0
                                      }) ▾`}
                                </button>
                              )}
                          </div>
                        </div>

                        {/* Collapsible X-Ray Drawer: Only visible when toggled */}
                        <AnimatePresence>
                          {isContextOpen && msg.telemetry && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden rounded-xl border border-line bg-surface p-3.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] text-muted">
                                <span>
                                  Sent{" "}
                                  <strong className="text-ink">
                                    {msg.telemetry.tokensSent.toLocaleString()}
                                  </strong>{" "}
                                  tokens instead of{" "}
                                  {msg.telemetry.fullRepoTokens.toLocaleString()}{" "}
                                  full-repo tokens
                                </span>
                                <span>{msg.telemetry.retrievalMethod}</span>
                              </div>

                              {msg.retrievedFunctions?.length > 0 && (
                                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                                  {msg.retrievedFunctions.map((fn) => (
                                    <div
                                      key={fn.id}
                                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-ink">
                                          {fn.name}()
                                        </div>
                                        <div className="truncate text-[10px] text-muted">
                                          {fn.file}:L{fn.startLine}–L{fn.endLine}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openFunctionInGraph(fn.id)}
                                        className="shrink-0 rounded border border-line px-2 py-0.5 text-[10px] text-ink-soft hover:border-ink hover:text-accent"
                                      >
                                        Graph →
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Primary Answer Body (Front & Center) */}
                        <div className="pl-7">
                          <RagMarkdownContent
                            content={displayedMarkdown}
                            isStreaming={isThisMsgStreaming}
                          />

                          {/* Special One-Click Redirect Card when user asks for Report */}
                          {!isThisMsgStreaming && msg.redirectAction && (
                            <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-[#c8502a]/50 bg-[#fbeae4]/40 p-4 sm:flex-row sm:items-center">
                              <div>
                                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                                  Section 04 · Project Reports
                                </div>
                                <div className="mt-0.5 text-sm font-medium text-ink">
                                  {msg.redirectAction.description}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSection(
                                    msg.redirectAction.targetSection || "reports"
                                  )
                                }
                                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-ink px-4 py-2 font-mono text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                              >
                                {msg.redirectAction.buttonLabel}
                              </button>
                            </div>
                          )}

                          {/* Quiet Inline Flow Path + Follow-Up Pills (Shown Only After Answer) */}
                          {!isThisMsgStreaming &&
                            (cleanCallChain.length > 1 ||
                              msg.suggestedFollowUps?.length > 0) && (
                              <div className="mt-4 space-y-2.5 border-t border-line/70 pt-3">
                                {cleanCallChain.length > 1 && (
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                                      Path:
                                    </span>
                                    {cleanCallChain.map((step, idx) => (
                                      <span
                                        key={`${step.id}-${idx}`}
                                        className="inline-flex items-center gap-1.5"
                                      >
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openFunctionInGraph(step.id)
                                          }
                                          className="font-mono text-[11px] font-medium text-ink-soft underline decoration-line-strong underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
                                          title={step.file}
                                        >
                                          {step.name}()
                                        </button>
                                        {idx < cleanCallChain.length - 1 && (
                                          <span className="text-[11px] text-faint">
                                            →
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {msg.suggestedFollowUps?.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {msg.suggestedFollowUps
                                      .slice(0, 2)
                                      .map((followUp) => (
                                        <button
                                          key={followUp}
                                          type="button"
                                          disabled={askingRag}
                                          onClick={() =>
                                            handleAskSubmit(null, followUp)
                                          }
                                          className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
                                        >
                                          {followUp}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}

                  {askingRag && (
                    <div className="flex items-center gap-2.5 pl-1 text-xs text-muted">
                      <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
                      <span>Searching AST symbols &amp; writing answer…</span>
                    </div>
                  )}

                  <div ref={askEndRef} />
                </div>
              )}
            </div>

            {/* 3. FIXED BOTTOM LLM PROMPT DOCK (ALWAYS VISIBLE WITHOUT PAGE SCROLL) */}
            <div className="shrink-0 border-t border-line bg-paper px-6 py-3">
              <form
                onSubmit={(e) => handleAskSubmit(e)}
                className="mx-auto max-w-3xl"
              >
                <div className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4 py-2 shadow-sm transition-colors focus-within:border-ink">
                  <input
                    type="text"
                    value={askInput}
                    onChange={(e) => setAskInput(e.target.value)}
                    disabled={askingRag}
                    placeholder={`Ask anything about ${analysis.repoName}…`}
                    className="h-9 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-faint focus:outline-none disabled:opacity-60"
                  />
                  {streamingMsgId && (
                    <button
                      type="button"
                      onClick={stopSequentialStream}
                      className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-line px-3 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
                    >
                      Finish
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={askingRag || !askInput.trim()}
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-xs font-medium text-paper transition-colors hover:bg-ink-soft disabled:opacity-35"
                  >
                    {askingRag ? "Thinking…" : "Ask →"}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-2 font-mono text-[10px] text-faint">
                  <span>
                    Graph-aware AST RAG · Whole-project reports redirect to
                    Section 04
                  </span>
                  <span>Enter ↵</span>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION 4: PROJECT REPORTS (BRIEF OVERVIEW + ON-DEMAND)   */}
        {/* ========================================================= */}
        {activeSection === "reports" && (
          <main className="mx-auto w-full max-w-5xl space-y-8 p-6 md:px-10 md:py-10">
            {/* Top Report Mode Switcher & Actions Bar */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line-strong bg-surface p-6 shadow-sm md:flex-row md:items-center">
              <div>
                <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Section 04 · Project Intelligence Reports
                </div>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
                  {analysis.fullName}
                </h1>
                <p className="mt-1 text-xs text-muted">
                  Auto-generated Brief Overview for quick understanding &amp; presentations, plus on-demand Detailed Developer Audit.
                </p>
              </div>

              {/* Report Mode Switcher Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-line-strong bg-paper p-1">
                  <button
                    type="button"
                    onClick={() => setReportMode("brief")}
                    className={`rounded-lg px-3.5 py-2 font-mono text-xs transition-colors ${
                      reportMode === "brief"
                        ? "bg-ink font-medium text-paper"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    01 · Brief Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportMode("detailed")}
                    className={`rounded-lg px-3.5 py-2 font-mono text-xs transition-colors ${
                      reportMode === "detailed"
                        ? "bg-ink font-medium text-paper"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    02 · Detailed Audit
                  </button>
                </div>
              </div>
            </div>

            {/* ======================================================= */}
            {/* MODE I: BRIEF OVERVIEW REPORT (AUTO-GENERATED)          */}
            {/* ======================================================= */}
            {reportMode === "brief" && (
              <>
                {briefLoading && !briefReport && (
                  <div className="space-y-6 rounded-2xl border border-line-strong bg-surface p-8">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
                      <div className="font-mono text-xs uppercase tracking-wider text-ink">
                        Synthesizing Brief Overview Report via Groq (`openai/gpt-oss-120b`)…
                      </div>
                    </div>
                    <p className="max-w-xl text-sm leading-relaxed text-muted">
                      Reading all {analysis.fileCount} source files, {analysis.functionCount} AST functions, and {analysis.packageCount} packages to build a clean overview, system workflow diagrams, tech stack guide, and plain-English function breakdown.
                    </p>
                    <div className="grid gap-4 pt-2 sm:grid-cols-3">
                      <div className="h-24 animate-pulse rounded-xl bg-sunken" />
                      <div className="h-24 animate-pulse rounded-xl bg-sunken" />
                      <div className="h-24 animate-pulse rounded-xl bg-sunken" />
                    </div>
                  </div>
                )}

                {briefError && !briefLoading && (
                  <div className="rounded-2xl border border-[#c8502a]/50 bg-[#fbeae4]/40 p-6">
                    <div className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                      Brief Report Generation Failed
                    </div>
                    <p className="mt-1.5 text-sm text-ink">{briefError}</p>
                    <button
                      type="button"
                      onClick={() => fetchBriefReport(true)}
                      className="mt-4 rounded-lg bg-ink px-4 py-2 font-mono text-xs font-medium text-paper hover:bg-ink-soft"
                    >
                      Retry Generation →
                    </button>
                  </div>
                )}

                {briefReport && (
                  <div className="space-y-8 pb-8">
                    {/* Action Strip (Model, Cached Badge, Copy PPT/Docs, Regenerate) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                        <span className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-ink">
                          Model: {briefReport.meta?.model || "openai/gpt-oss-120b"}
                        </span>
                        <span className="rounded-md border border-line bg-surface px-2.5 py-1">
                          {briefCached ? "Saved in workspace" : "Freshly generated"}
                        </span>
                        {briefReport.meta?.tokensUsed > 0 && (
                          <span className="rounded-md border border-line bg-surface px-2.5 py-1">
                            {briefReport.meta.tokensUsed.toLocaleString()} tokens
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyBriefMarkdown}
                          className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-mono text-xs text-ink transition-colors hover:border-ink"
                        >
                          {copiedReportMd ? "Copied for Docs / PPT ✓" : "Copy for Docs / PPT"}
                        </button>
                        <button
                          type="button"
                          disabled={briefLoading}
                          onClick={() => fetchBriefReport(true)}
                          className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-mono text-xs text-ink transition-colors hover:border-ink disabled:opacity-50"
                        >
                          {briefLoading ? "Regenerating…" : "↻ Regenerate Brief"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportMode("detailed")}
                          className="rounded-lg bg-ink px-3.5 py-2 font-mono text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                        >
                          Detailed Report →
                        </button>
                      </div>
                    </div>

                    {/* 1. WHAT THIS PROJECT IS + PROBLEM & SOLUTION + SNAPSHOT STATS */}
                    <section className="space-y-6 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                      <div className="space-y-3">
                        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                          01 · Project Identity &amp; Purpose
                        </div>
                        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                          {briefReport.headline}
                        </h2>
                        <div className="max-w-3xl space-y-3 text-[15px] leading-[1.75] text-[#2b2923]">
                          {String(briefReport.whatIsProject || "")
                            .split(/\n{2,}/)
                            .filter(Boolean)
                            .map((para, pIdx) => (
                              <p key={pIdx}>{para}</p>
                            ))}
                        </div>
                      </div>

                      {/* Slide-Ready AST Metrics Strip */}
                      <div className="grid grid-cols-2 gap-3 border-y border-line py-5 sm:grid-cols-5">
                        <div className="rounded-xl border border-line bg-paper p-3.5">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Source Files
                          </div>
                          <div className="mt-1 font-mono text-xl font-semibold text-ink">
                            {analysis.fileCount}
                          </div>
                        </div>
                        <div className="rounded-xl border border-line bg-paper p-3.5">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            AST Functions
                          </div>
                          <div className="mt-1 font-mono text-xl font-semibold text-accent">
                            {analysis.functionCount}
                          </div>
                        </div>
                        <div className="rounded-xl border border-line bg-paper p-3.5">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Packages
                          </div>
                          <div className="mt-1 font-mono text-xl font-semibold text-ink">
                            {analysis.packageCount}
                          </div>
                        </div>
                        <div className="rounded-xl border border-line bg-paper p-3.5">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Lines of Code
                          </div>
                          <div className="mt-1 font-mono text-xl font-semibold text-ink">
                            {(analysis.totalLines || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-2 rounded-xl border border-line bg-paper p-3.5 sm:col-span-1">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Health Score
                          </div>
                          <div className="mt-1 font-mono text-xl font-semibold text-sage">
                            {analysis.healthScore || 90}%
                          </div>
                        </div>
                      </div>

                      {/* Language Share Bar */}
                      {analysis.languages?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted">
                            <span>LANGUAGE COMPOSITION</span>
                            <div className="flex flex-wrap gap-3">
                              {analysis.languages.slice(0, 5).map((lang) => (
                                <span key={lang.name} className="text-ink-soft">
                                  {lang.name}{" "}
                                  <strong className="text-ink">{lang.percentage}%</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-sunken">
                            {analysis.languages.slice(0, 5).map((lang, idx) => {
                              const barColors = [
                                "bg-ink",
                                "bg-accent",
                                "bg-[#2f6f4e]",
                                "bg-[#8a5a19]",
                                "bg-muted",
                              ];
                              return (
                                <div
                                  key={lang.name}
                                  style={{ width: `${Math.max(4, lang.percentage)}%` }}
                                  className={`${barColors[idx % barColors.length]} transition-all`}
                                  title={`${lang.name}: ${lang.percentage}%`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2-Column Problem & Solution Split */}
                      <div className="grid gap-5 pt-2 md:grid-cols-2">
                        <div className="rounded-xl border border-[#c8502a]/25 bg-[#fdf8f5] p-5 space-y-2">
                          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-accent">
                            What Problem It Solves
                          </div>
                          <p className="text-[14px] leading-[1.7] text-[#2b2923]">
                            {briefReport.problemAndSolution?.problem}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#2f6f4e]/25 bg-[#f6faf7] p-5 space-y-3">
                          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[#2f6f4e]">
                            How This Project Solves It
                          </div>
                          <p className="text-[14px] leading-[1.7] text-[#2b2923]">
                            {briefReport.problemAndSolution?.solution}
                          </p>
                          {briefReport.problemAndSolution?.idealUseCases?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {briefReport.problemAndSolution.idealUseCases.map((uc) => (
                                <span
                                  key={uc}
                                  className="rounded-full border border-[#2f6f4e]/25 bg-surface px-2.5 py-0.5 text-[11.5px] font-medium text-ink-soft"
                                >
                                  {uc}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* 2. VISUAL SYSTEM ARCHITECTURE & COMPLETE WORKFLOW DESIGN */}
                    <section className="space-y-7 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            02 · System Design &amp; Complete Workflow
                          </div>
                          <h2 className="text-xl font-semibold tracking-tight text-ink">
                            How Everything Connects End-to-End
                          </h2>
                          {briefReport.completeWorkflow?.overview && (
                            <p className="max-w-3xl text-[14px] leading-[1.7] text-muted">
                              {briefReport.completeWorkflow.overview}
                            </p>
                          )}
                        </div>
                        {briefReport.architectureDesign?.pattern && (
                          <span className="rounded-lg border border-line-strong bg-paper px-3 py-1.5 font-mono text-[11px] font-medium text-ink">
                            {briefReport.architectureDesign.pattern}
                          </span>
                        )}
                      </div>

                      {/* 2A. Visual Connected Layer Architecture Diagram */}
                      {briefReport.architectureDesign?.layers?.length > 0 && (
                        <div className="rounded-xl border border-line bg-paper p-5 space-y-4">
                          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            Architecture Blueprint Diagram
                          </div>
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                            {briefReport.architectureDesign.layers.map((layer, lIdx) => {
                              const accents = [
                                "border-t-ink",
                                "border-t-accent",
                                "border-t-[#2f6f4e]",
                                "border-t-[#8a5a19]",
                              ];
                              return (
                                <div
                                  key={`${layer.layerName}-${lIdx}`}
                                  className="flex flex-1 flex-col items-stretch gap-2 lg:flex-row lg:items-center"
                                >
                                  <div
                                    className={`flex h-full flex-1 flex-col justify-between rounded-xl border border-line-strong border-t-[3px] bg-surface p-4 ${
                                      accents[lIdx % accents.length]
                                    }`}
                                  >
                                    <div>
                                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                                        Layer 0{layer.stepOrder || lIdx + 1}
                                      </div>
                                      <div className="mt-1 text-sm font-semibold text-ink">
                                        {layer.layerName}
                                      </div>
                                      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                                        {layer.role}
                                      </p>
                                    </div>
                                    {(layer.technologies?.length > 0 ||
                                      layer.keyFiles?.length > 0) && (
                                      <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-2.5">
                                        {layer.technologies?.slice(0, 3).map((t) => (
                                          <span
                                            key={t}
                                            className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-ink"
                                          >
                                            {t}
                                          </span>
                                        ))}
                                        {layer.keyFiles?.slice(0, 2).map((kf) => (
                                          <span
                                            key={kf}
                                            className="truncate rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted"
                                          >
                                            {kf.split("/").pop()}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {lIdx < briefReport.architectureDesign.layers.length - 1 && (
                                    <div className="flex shrink-0 items-center justify-center py-0.5 font-mono text-sm text-accent lg:px-0.5">
                                      <span className="hidden lg:inline">→</span>
                                      <span className="lg:hidden">↓</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 2B. Visual Step-by-Step Workflow Pipeline */}
                      {briefReport.completeWorkflow?.steps?.length > 0 && (
                        <div className="space-y-4">
                          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            End-to-End Execution Pipeline
                          </div>
                          <div className="relative space-y-4 pl-6 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-[1.5px] before:bg-line-strong">
                            {briefReport.completeWorkflow.steps.map((step, sIdx) => (
                              <div
                                key={`${step.title}-${sIdx}`}
                                className="relative rounded-xl border border-line bg-paper p-5 transition-colors hover:border-line-strong"
                              >
                                {/* Timeline Circle Node */}
                                <span className="absolute -left-[25px] top-5 flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[11px] font-semibold text-accent shadow-xs">
                                  {step.stepNumber || sIdx + 1}
                                </span>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-paper">
                                      {step.actor}
                                    </span>
                                    <h3 className="text-[15px] font-semibold text-ink">
                                      {step.title}
                                    </h3>
                                  </div>
                                  {step.keyComponent && (
                                    <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[11px] text-ink-soft">
                                      {step.keyComponent}
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 text-[14px] leading-[1.68] text-[#2b2923]">
                                  {step.summary}
                                </p>

                                {step.output && (
                                  <div className="mt-2.5 flex items-center gap-2 text-xs text-muted">
                                    <span className="font-mono text-[10px] uppercase tracking-wider text-sage">
                                      Output →
                                    </span>
                                    <span className="text-ink-soft">{step.output}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2C. Visual Sub-Workflow Journey Cards */}
                      {briefReport.completeWorkflow?.secondaryFlows?.length > 0 && (
                        <div className="space-y-3 pt-1">
                          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                            Key User &amp; Feature Journeys
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            {briefReport.completeWorkflow.secondaryFlows.map((flow, fIdx) => (
                              <div
                                key={`${flow.name}-${fIdx}`}
                                className="rounded-xl border border-line bg-paper p-5 space-y-3"
                              >
                                <div>
                                  <h4 className="text-sm font-semibold text-ink">
                                    {flow.name}
                                  </h4>
                                  {flow.summary && (
                                    <p className="mt-1 text-xs leading-relaxed text-muted">
                                      {flow.summary}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {flow.steps.map((st, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink-soft">
                                        <span className="font-mono text-[10px] font-semibold text-accent">
                                          {idx + 1}
                                        </span>
                                        <span>{st}</span>
                                      </span>
                                      {idx < flow.steps.length - 1 && (
                                        <span className="font-mono text-xs text-muted">
                                          →
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* 3. TECH STACK USED (PLAIN ENGLISH) */}
                    {briefReport.techStack?.length > 0 && (
                      <section className="space-y-5 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            03 · Tech Stack Explained Simply
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            Tools, Libraries &amp; Why Each Exists
                          </h2>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          {briefReport.techStack.map((group) => (
                            <div
                              key={group.category}
                              className="rounded-xl border border-line bg-paper p-5 space-y-3.5"
                            >
                              <div className="border-b border-line pb-2.5">
                                <div className="text-sm font-semibold text-ink">
                                  {group.category}
                                </div>
                                {group.purposeSummary && (
                                  <div className="mt-0.5 text-xs text-muted">
                                    {group.purposeSummary}
                                  </div>
                                )}
                              </div>
                              <ul className="space-y-2.5">
                                {group.items.map((item) => (
                                  <li key={item.name} className="text-[13.5px] leading-relaxed">
                                    <span className="mr-2 inline-block rounded bg-sunken px-2 py-0.5 font-mono text-[11.5px] font-medium text-ink">
                                      {item.name}
                                    </span>
                                    <span className="text-[#2b2923]">
                                      {item.roleInProject}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 4. KEY FILES & MODULES BREAKDOWN */}
                    {briefReport.filesAndModules?.length > 0 && (
                      <section className="space-y-5 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            04 · Project Structure &amp; Key Files
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            Where Important Logic Lives
                          </h2>
                        </div>

                        <div className="space-y-5">
                          {briefReport.filesAndModules.map((mod) => (
                            <div
                              key={mod.folderOrCategory}
                              className="overflow-hidden rounded-xl border border-line bg-paper"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken/70 px-5 py-3">
                                <span className="text-sm font-semibold text-ink">
                                  {mod.folderOrCategory}
                                </span>
                                {mod.summary && (
                                  <span className="text-xs text-muted">{mod.summary}</span>
                                )}
                              </div>
                              <div className="divide-y divide-line">
                                {mod.files.map((f) => (
                                  <div
                                    key={f.path}
                                    className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-baseline sm:gap-4"
                                  >
                                    <span className="shrink-0 font-mono text-xs font-medium text-ink sm:w-64 sm:truncate">
                                      {f.path}
                                    </span>
                                    <p className="flex-1 text-[13.5px] leading-relaxed text-[#2b2923]">
                                      {f.role}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* 5. MAIN FUNCTIONS EXPLAINED SIMPLY */}
                    {briefReport.mainFunctions?.length > 0 && (
                      <section className="space-y-5 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                              05 · Core Functions Explained
                            </div>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                              Key Functions Behind the Project ({briefReport.mainFunctions.length})
                            </h2>
                          </div>
                          <span className="font-mono text-[11px] text-muted">
                            Click any function to inspect its AST graph or ask AI
                          </span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {briefReport.mainFunctions.map((fnItem, idx) => {
                            const matchedAstFn = allFunctions.find(
                              (f) =>
                                f.name.toLowerCase() === fnItem.name.toLowerCase() &&
                                (!fnItem.file || f.file === fnItem.file)
                            ) || allFunctions.find(
                              (f) => f.name.toLowerCase() === fnItem.name.toLowerCase()
                            );
                            const critStyle = matchedAstFn
                              ? getCriticalityStyles(matchedAstFn.criticality)
                              : null;

                            return (
                              <div
                                key={`${fnItem.name}-${idx}`}
                                className="flex flex-col justify-between rounded-xl border border-line bg-paper p-5 space-y-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-mono text-[13.5px] font-semibold text-ink">
                                      {fnItem.name}()
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {fnItem.layer && (
                                        <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-muted">
                                          {fnItem.layer}
                                        </span>
                                      )}
                                      {critStyle && (
                                        <span
                                          className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${critStyle.bg} ${critStyle.border} ${critStyle.text}`}
                                        >
                                          {matchedAstFn.criticality}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {fnItem.file && (
                                    <div className="truncate font-mono text-[11px] text-muted">
                                      {fnItem.file}
                                    </div>
                                  )}

                                  <p className="text-[13.5px] leading-[1.68] text-[#2b2923]">
                                    {fnItem.whatItDoes}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                                  <span className="truncate text-[11.5px] text-muted">
                                    {fnItem.interactsWith
                                      ? `Connects: ${fnItem.interactsWith}`
                                      : matchedAstFn
                                      ? `${matchedAstFn.affectedFilesCount} file(s) impact`
                                      : ""}
                                  </span>
                                  {matchedAstFn && (
                                    <div className="flex shrink-0 items-center gap-2 font-mono text-[10.5px]">
                                      <button
                                        type="button"
                                        onClick={() => openFunctionInGraph(matchedAstFn.id)}
                                        className="rounded border border-line bg-surface px-2 py-1 text-ink-soft hover:border-ink hover:text-ink"
                                      >
                                        Graph →
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => askAiAboutFunction(matchedAstFn)}
                                        className="rounded border border-line bg-surface px-2 py-1 text-accent hover:border-accent"
                                      >
                                        Ask AI →
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* 6. EXECUTIVE & ANALYST TAKEAWAYS */}
                    {briefReport.keyTakeaways?.length > 0 && (
                      <section className="space-y-4 rounded-2xl border border-line-strong bg-surface p-7 md:p-9">
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            06 · Key Takeaways &amp; Highlights
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            Summary Points for Slides &amp; Quick Reviews
                          </h2>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {briefReport.keyTakeaways.map((tk, idx) => (
                            <div
                              key={`${tk.title}-${idx}`}
                              className="rounded-xl border border-line bg-paper p-5 space-y-1.5"
                            >
                              <span className="inline-block rounded bg-sunken px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                                {tk.tag}
                              </span>
                              <div className="pt-1 text-sm font-semibold text-ink">
                                {tk.title}
                              </div>
                              <p className="text-[13.5px] leading-relaxed text-[#2b2923]">
                                {tk.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ======================================================= */}
            {/* MODE II: DETAILED DEVELOPER AUDIT (ON-DEMAND ONLY)      */}
            {/* ======================================================= */}
            {reportMode === "detailed" && (
              <>
                {/* 1. ON-DEMAND LAUNCH CARD (When Detailed Report Has Not Been Requested Yet) */}
                {!detailedReport && !detailedLoading && (
                  <div className="rounded-2xl border border-line-strong bg-surface p-8 md:p-10 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-sunken px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        Report Mode II · On-Demand Developer Encyclopedia
                      </span>
                      <button
                        type="button"
                        onClick={() => setReportMode("brief")}
                        className="font-mono text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        ← Back to Brief Overview Report
                      </button>
                    </div>

                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight text-ink">
                        Complete Developer Code, Workflow &amp; Function Reference
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                        Designed for engineers joining this repository, developers auditing every architectural boundary, and students who want to understand every file, function, library version, and execution flow in depth without needing to open the raw codebase again. Generated <strong className="font-medium text-ink">only when you ask</strong>.
                      </p>
                    </div>

                    {detailedError && (
                      <div className="rounded-xl border border-[#c8502a]/50 bg-[#fbeae4]/40 p-4 text-sm text-ink">
                        <strong className="font-mono text-xs uppercase text-accent">
                          Error:{" "}
                        </strong>
                        {detailedError}
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl border border-line bg-paper p-5">
                        <div className="font-mono text-xs font-semibold text-accent">
                          Chapter 01 &amp; 02
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-ink">
                          Deep Architecture &amp; Execution Workflows
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Subsystem breakdown and step-by-step developer execution traces citing exact file paths, function names, payloads, and error handling.
                        </p>
                      </div>
                      <div className="rounded-xl border border-line bg-paper p-5">
                        <div className="font-mono text-xs font-semibold text-accent">
                          Chapter 03 &amp; 04
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-ink">
                          All {analysis.packageCount} Packages &amp; All {analysis.fileCount} Files
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Every dependency with its exact version, files importing it, and best modern alternatives, plus a file-by-file walkthrough of all {analysis.fileCount} files.
                        </p>
                      </div>
                      <div className="rounded-xl border border-line bg-paper p-5 sm:col-span-2 lg:col-span-1">
                        <div className="font-mono text-xs font-semibold text-accent">
                          Chapter 05 &amp; 06
                        </div>
                        <div className="mt-1.5 text-sm font-semibold text-ink">
                          All {analysis.functionCount} Functions + Developer Playbook
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Every function explained with embedded AST source code, plus env vars, security hardening, how to extend the repo, and interview/viva Q&amp;A.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-strong bg-paper p-5">
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          Ready to generate your complete developer handbook
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-muted">
                          Runs a 2-pass Groq (`openai/gpt-oss-120b`) synthesis + 100% AST inventory merge across {analysis.fileCount} files &amp; {analysis.functionCount} functions
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchDetailedReport(true)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-ink px-5 py-3 font-mono text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                      >
                        Generate Detailed Developer Report →
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. LOADING STATE WHILE 2-PASS SYNTHESIS RUNS */}
                {detailedLoading && !detailedReport && (
                  <div className="space-y-6 rounded-2xl border border-line-strong bg-surface p-8 md:p-10">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
                      <div className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                        Building Exhaustive Detailed Developer Report (`openai/gpt-oss-120b`)…
                      </div>
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-muted">
                      Running 2-pass deep synthesis and merging with the complete AST inventory: documenting all{" "}
                      <strong className="text-ink">{analysis.fileCount} source files</strong>, all{" "}
                      <strong className="text-ink">{analysis.functionCount} functions</strong> (with source code), all{" "}
                      <strong className="text-ink">{analysis.packageCount} packages &amp; versions</strong>, end-to-end execution workflows, and out-of-the-box engineering insights.
                    </p>
                    <div className="grid gap-4 pt-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-line bg-paper p-4">
                        <div className="font-mono text-[10px] uppercase text-accent">
                          Pass 01 · Active
                        </div>
                        <div className="mt-1 text-xs font-semibold text-ink">
                          Architecture, Workflows &amp; Packages Audit
                        </div>
                      </div>
                      <div className="rounded-xl border border-line bg-paper p-4">
                        <div className="font-mono text-[10px] uppercase text-accent">
                          Pass 02 · Active
                        </div>
                        <div className="mt-1 text-xs font-semibold text-ink">
                          All Files, Functions &amp; Developer Playbook
                        </div>
                      </div>
                      <div className="rounded-xl border border-line bg-paper p-4">
                        <div className="font-mono text-[10px] uppercase text-sage">
                          AST Merge · 100%
                        </div>
                        <div className="mt-1 text-xs font-semibold text-ink">
                          Full Source Snippets &amp; Call Graph Links
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. COMPLETE 6-CHAPTER DETAILED DEVELOPER REPORT */}
                {detailedReport && (
                  <div className="space-y-9 pb-12">
                    {/* Top Action & Chapter Jump Bar */}
                    <div className="space-y-4 rounded-2xl border border-line-strong bg-surface p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                          <span className="rounded-md bg-ink px-2.5 py-1 font-semibold text-paper">
                            DETAILED DEVELOPER HANDBOOK
                          </span>
                          <span className="rounded-md border border-line-strong bg-paper px-2.5 py-1 text-ink">
                            Model: {detailedReport.meta?.model || "openai/gpt-oss-120b"}
                          </span>
                          <span className="rounded-md border border-line bg-paper px-2.5 py-1">
                            {detailedReport.fileWalkthroughs?.length || analysis.fileCount} files ·{" "}
                            {detailedReport.functionEncyclopedia?.length || analysis.functionCount} functions ·{" "}
                            {detailedReport.packagesAndLibrariesAudit?.length || analysis.packageCount} packages
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyDetailedMarkdown}
                            className="rounded-lg border border-line-strong bg-paper px-3.5 py-2 font-mono text-xs text-ink transition-colors hover:border-ink"
                          >
                            {copiedDetailedMd ? "Copied Full Handbook ✓" : "Copy Full Markdown"}
                          </button>
                          <button
                            type="button"
                            disabled={detailedLoading}
                            onClick={() => fetchDetailedReport(true)}
                            className="rounded-lg border border-line-strong bg-paper px-3.5 py-2 font-mono text-xs text-ink transition-colors hover:border-ink disabled:opacity-50"
                          >
                            {detailedLoading ? "Regenerating…" : "↻ Regenerate Detailed"}
                          </button>
                        </div>
                      </div>

                      {/* Quick Chapter Anchor Bar */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 font-mono text-[11px]">
                        <span className="text-muted">Chapters:</span>
                        {[
                          { id: "chap-arch", label: "01 · Architecture" },
                          { id: "chap-workflows", label: "02 · Execution Workflows" },
                          {
                            id: "chap-packages",
                            label: `03 · Libraries & Versions (${
                              detailedReport.packagesAndLibrariesAudit?.length || 0
                            })`,
                          },
                          {
                            id: "chap-files",
                            label: `04 · All Files (${
                              detailedReport.fileWalkthroughs?.length || 0
                            })`,
                          },
                          {
                            id: "chap-functions",
                            label: `05 · All Functions (${
                              detailedReport.functionEncyclopedia?.length || 0
                            })`,
                          },
                          {
                            id: "chap-playbook",
                            label: "06 · Out-of-the-Box & Interview Playbook",
                          },
                        ].map((ch) => (
                          <a
                            key={ch.id}
                            href={`#${ch.id}`}
                            className="rounded-md border border-line bg-paper px-2.5 py-1 text-ink-soft transition-colors hover:border-ink hover:text-accent"
                          >
                            {ch.label}
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* =================================================== */}
                    {/* CHAPTER 01: DEEP SYSTEM & SUBSYSTEM ARCHITECTURE    */}
                    {/* =================================================== */}
                    <section
                      id="chap-arch"
                      className="space-y-6 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                    >
                      <div className="space-y-3">
                        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                          Chapter 01 · Deep Architectural &amp; Runtime Blueprint
                        </div>
                        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                          {detailedReport.headline}
                        </h2>
                        <div className="space-y-3.5 text-[14.5px] leading-[1.78] text-[#2b2923]">
                          {String(detailedReport.executiveEngineeringSummary || "")
                            .split(/\n{2,}/)
                            .filter(Boolean)
                            .map((para, idx) => (
                              <p key={idx}>{renderInlineMarkdown(para)}</p>
                            ))}
                          {detailedReport.systemArchitectureDeepDive?.overview && (
                            <p className="rounded-xl border border-line bg-paper p-4 text-[14px] leading-[1.72] text-ink-soft">
                              {renderInlineMarkdown(
                                detailedReport.systemArchitectureDeepDive.overview
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {detailedReport.systemArchitectureDeepDive?.subsystemBreakdown
                        ?.length > 0 && (
                        <div className="space-y-4 pt-2">
                          <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
                            Subsystem-by-Subsystem Engineering Breakdown
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            {detailedReport.systemArchitectureDeepDive.subsystemBreakdown.map(
                              (sub, idx) => (
                                <div
                                  key={`${sub.subsystem}-${idx}`}
                                  className="flex flex-col justify-between rounded-xl border border-line bg-paper p-5 space-y-3"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="text-[15px] font-semibold text-ink">
                                        {sub.subsystem}
                                      </h3>
                                      <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-accent">
                                        0{idx + 1}
                                      </span>
                                    </div>
                                    {sub.files?.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {sub.files.map((fp) => (
                                          <span
                                            key={fp}
                                            className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink"
                                          >
                                            {fp}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <p className="text-[13.5px] leading-[1.7] text-[#2b2923]">
                                      {renderInlineMarkdown(sub.deepExplanation)}
                                    </p>
                                  </div>

                                  {sub.dataFlowAndState && (
                                    <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-soft">
                                      <strong className="font-mono text-[10px] uppercase tracking-wider text-accent">
                                        State &amp; Data Flow:{" "}
                                      </strong>
                                      {renderInlineMarkdown(sub.dataFlowAndState)}
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* =================================================== */}
                    {/* CHAPTER 02: EXHAUSTIVE EXECUTION WORKFLOWS          */}
                    {/* =================================================== */}
                    {detailedReport.detailedWorkflows?.length > 0 && (
                      <section
                        id="chap-workflows"
                        className="space-y-7 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            Chapter 02 · Exhaustive End-to-End Execution Workflows
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            File-by-File &amp; Function-by-Function Runtime Traces ({detailedReport.detailedWorkflows.length} Workflows)
                          </h2>
                          <p className="mt-1 text-xs text-muted">
                            Every step names the exact file path, function invoked, request/state payload, and error-handling behavior.
                          </p>
                        </div>

                        <div className="space-y-8">
                          {detailedReport.detailedWorkflows.map((wf, wIdx) => (
                            <div
                              key={`${wf.workflowName}-${wIdx}`}
                              className="rounded-2xl border border-line-strong bg-paper p-6 space-y-5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                                <div>
                                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                                    Workflow 0{wIdx + 1}
                                  </div>
                                  <h3 className="mt-0.5 text-lg font-semibold text-ink">
                                    {wf.workflowName}
                                  </h3>
                                  {wf.overview && (
                                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                                      {renderInlineMarkdown(wf.overview)}
                                    </p>
                                  )}
                                </div>
                                {wf.triggerAndEntryFile && (
                                  <span className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 font-mono text-[11px] text-ink">
                                    Entry: {wf.triggerAndEntryFile}
                                  </span>
                                )}
                              </div>

                              <div className="relative space-y-4 pl-6 before:absolute before:bottom-4 before:left-[14px] before:top-4 before:w-[1.5px] before:bg-line-strong">
                                {wf.steps.map((st, sIdx) => (
                                  <div
                                    key={`${st.actionTitle}-${sIdx}`}
                                    className="relative rounded-xl border border-line bg-surface p-5 space-y-2.5"
                                  >
                                    <span className="absolute -left-[25px] top-5 flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-paper font-mono text-[11px] font-semibold text-accent">
                                      {st.stepNumber || sIdx + 1}
                                    </span>

                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <h4 className="text-[14.5px] font-semibold text-ink">
                                        {st.actionTitle}
                                      </h4>
                                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                                        {st.file && (
                                          <span className="rounded bg-sunken px-2 py-0.5 text-ink">
                                            {st.file}
                                          </span>
                                        )}
                                        {st.functionName && (
                                          <span className="rounded border border-[#c8502a]/35 bg-[#fbeae4]/45 px-2 py-0.5 font-medium text-accent">
                                            {st.functionName}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-[13.5px] leading-[1.7] text-[#2b2923]">
                                      {renderInlineMarkdown(st.detailedExplanation)}
                                    </p>

                                    {(st.dataAndPayload || st.errorHandlingAndEdgeCases) && (
                                      <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
                                        {st.dataAndPayload && (
                                          <div className="rounded-lg border border-line bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
                                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
                                              Payload &amp; Data:{" "}
                                            </span>
                                            {renderInlineMarkdown(st.dataAndPayload)}
                                          </div>
                                        )}
                                        {st.errorHandlingAndEdgeCases && (
                                          <div className="rounded-lg border border-line bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
                                            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                                              Error / Edge Cases:{" "}
                                            </span>
                                            {renderInlineMarkdown(
                                              st.errorHandlingAndEdgeCases
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* =================================================== */}
                    {/* CHAPTER 03: LIBRARIES, VERSIONS & ALTERNATIVES      */}
                    {/* =================================================== */}
                    {detailedReport.packagesAndLibrariesAudit?.length > 0 && (
                      <section
                        id="chap-packages"
                        className="space-y-6 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            Chapter 03 · Complete Libraries, Versions &amp; Alternatives Audit
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            All {detailedReport.packagesAndLibrariesAudit.length} Dependencies, Exact Versions &amp; Engineering Trade-Offs
                          </h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {detailedReport.packagesAndLibrariesAudit.map((pkg) => (
                            <div
                              key={pkg.name}
                              className="flex flex-col justify-between rounded-xl border border-line bg-paper p-5 space-y-3"
                            >
                              <div className="space-y-2.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[14px] font-semibold text-ink">
                                      {pkg.name}
                                    </span>
                                    <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10.5px] text-paper">
                                      {pkg.version}
                                    </span>
                                  </div>
                                  <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                                    {pkg.type} · {pkg.usedInFilesCount || 0} file(s)
                                  </span>
                                </div>

                                {pkg.usedInFiles?.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="font-mono text-[10px] text-muted">
                                      Imported in:
                                    </span>
                                    {pkg.usedInFiles.map((uf) => (
                                      <span
                                        key={uf}
                                        className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
                                      >
                                        {uf}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <p className="text-[13.5px] leading-[1.68] text-[#2b2923]">
                                  <strong className="font-medium text-ink">Role: </strong>
                                  {renderInlineMarkdown(pkg.purposeInRepo)}
                                </p>

                                <p className="text-xs leading-relaxed text-ink-soft">
                                  <strong className="font-medium text-ink">
                                    How it is used here:{" "}
                                  </strong>
                                  {renderInlineMarkdown(pkg.howItWorksHere)}
                                </p>
                              </div>

                              <div className="space-y-1.5 rounded-lg border border-line bg-surface p-3 text-xs">
                                <div>
                                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                                    Best Alternatives:{" "}
                                  </span>
                                  <span className="font-medium text-ink">
                                    {pkg.bestAlternatives}
                                  </span>
                                </div>
                                <div className="leading-relaxed text-muted">
                                  {renderInlineMarkdown(pkg.whyCurrentOrWhenToSwitch)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* =================================================== */}
                    {/* CHAPTER 04: COMPLETE FILE-BY-FILE WALKTHROUGH       */}
                    {/* =================================================== */}
                    {detailedReport.fileWalkthroughs?.length > 0 && (
                      <section
                        id="chap-files"
                        className="space-y-6 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                            Chapter 04 · Complete File-by-File Codebase Walkthrough
                          </div>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                            Every Source File Explained ({detailedReport.fileWalkthroughs.length} Files)
                          </h2>
                        </div>

                        <div className="space-y-4">
                          {detailedReport.fileWalkthroughs.map((f) => (
                            <div
                              key={f.path}
                              className="rounded-xl border border-line bg-paper p-5 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="font-mono text-sm font-semibold text-ink">
                                    {f.path}
                                  </span>
                                  <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-accent">
                                    {f.layer}
                                  </span>
                                </div>
                                <span className="font-mono text-xs text-muted">
                                  {f.language} · {f.lines} lines · {f.functionCount} fn(s)
                                </span>
                              </div>

                              <div className="text-xs font-medium text-ink">
                                {f.architecturalRole}
                              </div>

                              <p className="text-[13.5px] leading-[1.7] text-[#2b2923]">
                                {renderInlineMarkdown(f.detailedExplanation)}
                              </p>

                              <div className="flex flex-wrap gap-4 border-t border-line pt-2.5 text-xs text-muted">
                                <div>
                                  <strong className="font-mono text-[10px] uppercase text-ink">
                                    Cross-File Connections:{" "}
                                  </strong>
                                  <span>
                                    {renderInlineMarkdown(f.interactionsWithOtherFiles)}
                                  </span>
                                </div>
                              </div>

                              {(f.definedFunctions?.length > 0 ||
                                f.externalImports?.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {f.definedFunctions?.map((dfn) => (
                                    <span
                                      key={dfn}
                                      className="rounded border border-line-strong bg-surface px-2 py-0.5 font-mono text-[10.5px] text-ink"
                                    >
                                      fn: {dfn}
                                    </span>
                                  ))}
                                  {f.externalImports?.map((imp) => (
                                    <span
                                      key={imp}
                                      className="rounded bg-sunken px-2 py-0.5 font-mono text-[10.5px] text-muted"
                                    >
                                      pkg: {imp}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* =================================================== */}
                    {/* CHAPTER 05: COMPLETE FUNCTION-BY-FUNCTION REFERENCE */}
                    {/* =================================================== */}
                    {detailedReport.functionEncyclopedia?.length > 0 && (
                      <section
                        id="chap-functions"
                        className="space-y-6 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                      >
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                          <div>
                            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                              Chapter 05 · Complete Function-by-Function Encyclopedia
                            </div>
                            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                              All {detailedReport.functionEncyclopedia.length} AST Functions — Logic, Call Graph &amp; Source Code
                            </h2>
                            <p className="mt-1 text-xs text-muted">
                              Includes step-by-step logic, inputs/outputs, blast radius, and actual source code for every function.
                            </p>
                          </div>

                          {/* Search & Filter Controls */}
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={detailedFnSearch}
                              onChange={(e) => setDetailedFnSearch(e.target.value)}
                              placeholder="Search function or file…"
                              className="h-9 w-52 rounded-lg border border-line-strong bg-paper px-3 font-mono text-xs text-ink placeholder:text-faint focus:border-ink focus:outline-none"
                            />
                            <select
                              value={detailedFnLayer}
                              onChange={(e) => setDetailedFnLayer(e.target.value)}
                              className="h-9 rounded-lg border border-line-strong bg-paper px-2.5 font-mono text-xs text-ink focus:border-ink focus:outline-none"
                            >
                              <option value="ALL">All Layers ({detailedReport.functionEncyclopedia.length})</option>
                              <option value="Frontend & UI">Frontend &amp; UI</option>
                              <option value="API & Controllers">API &amp; Controllers</option>
                              <option value="Core Logic & Services">Core Logic &amp; Services</option>
                              <option value="Database & Models">Database &amp; Models</option>
                              <option value="Entry & Config">Entry &amp; Config</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {detailedReport.functionEncyclopedia
                            .filter((fn) => {
                              const matchesLayer =
                                detailedFnLayer === "ALL" || fn.layer === detailedFnLayer;
                              const q = detailedFnSearch.trim().toLowerCase();
                              const matchesSearch =
                                !q ||
                                fn.name.toLowerCase().includes(q) ||
                                fn.file.toLowerCase().includes(q) ||
                                (fn.purposeSummary || "").toLowerCase().includes(q);
                              return matchesLayer && matchesSearch;
                            })
                            .map((fn, idx) => {
                              const crit = getCriticalityStyles(fn.criticality);
                              const isCodeOpen = Boolean(expandedFnSnippets[fn.id]);
                              return (
                                <div
                                  key={fn.id}
                                  className="rounded-xl border border-line-strong bg-paper p-5 space-y-3.5"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs text-muted">
                                          #{idx + 1}
                                        </span>
                                        <span className="font-mono text-[14.5px] font-semibold text-ink">
                                          {fn.signature}
                                        </span>
                                        <span
                                          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${crit.bg} ${crit.border} ${crit.text}`}
                                        >
                                          {fn.criticality}
                                        </span>
                                        <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-muted">
                                          {fn.layer}
                                        </span>
                                      </div>
                                      <div className="mt-1 font-mono text-xs text-muted">
                                        File:{" "}
                                        <strong className="text-ink">{fn.file}</strong>{" "}
                                        (Lines {fn.startLine}–{fn.endLine} · {fn.lineCount}L · Complexity {fn.complexity} · Blast Radius {fn.blastRadiusPercent}%)
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                                      <button
                                        type="button"
                                        onClick={() => toggleFnSnippet(fn.id)}
                                        className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-ink hover:border-ink"
                                      >
                                        {isCodeOpen ? "Hide Code ▴" : "View Source Code ▾"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openFunctionInGraph(fn.id)}
                                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-ink-soft hover:border-ink hover:text-ink"
                                      >
                                        Graph →
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => askAiAboutFunction(fn)}
                                        className="rounded-md border border-line bg-surface px-2.5 py-1 text-accent hover:border-accent"
                                      >
                                        Ask AI →
                                      </button>
                                    </div>
                                  </div>

                                  <div className="space-y-2 text-[13.5px] leading-[1.7] text-[#2b2923]">
                                    <p>
                                      <strong className="font-semibold text-ink">
                                        Purpose:{" "}
                                      </strong>
                                      {renderInlineMarkdown(fn.purposeSummary)}
                                    </p>
                                    <p>
                                      <strong className="font-semibold text-ink">
                                        Internal Step-by-Step Logic:{" "}
                                      </strong>
                                      {renderInlineMarkdown(fn.stepByStepLogic)}
                                    </p>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-soft">
                                      <strong className="font-mono text-[10px] uppercase tracking-wider text-ink">
                                        Inputs, Outputs &amp; Side Effects:{" "}
                                      </strong>
                                      {renderInlineMarkdown(fn.inputsAndOutputs)}
                                    </div>
                                    <div className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-soft">
                                      <strong className="font-mono text-[10px] uppercase tracking-wider text-accent">
                                        Edge Cases &amp; Blast Radius:{" "}
                                      </strong>
                                      {renderInlineMarkdown(fn.edgeCasesAndNotes)}
                                    </div>
                                  </div>

                                  {/* Callers, Callees & Affected Files Strip */}
                                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-line pt-2.5 font-mono text-[11px] text-muted">
                                    <span>
                                      <strong className="text-ink">Calls:</strong>{" "}
                                      {fn.callsFunctions?.length
                                        ? fn.callsFunctions.join(", ")
                                        : "None (leaf function)"}
                                    </span>
                                    <span>
                                      <strong className="text-ink">Called By:</strong>{" "}
                                      {fn.calledByFunctions?.length
                                        ? fn.calledByFunctions.join(", ")
                                        : "Entry / Route / UI handler"}
                                    </span>
                                    <span>
                                      <strong className="text-ink">
                                        Files Affected if Modified ({fn.affectedFilesCount}):
                                      </strong>{" "}
                                      {(fn.affectedFilesIfChanged || []).join(", ")}
                                    </span>
                                  </div>

                                  {/* Collapsible Embedded Source Code */}
                                  {isCodeOpen && fn.codeSnippet && (
                                    <div className="overflow-hidden rounded-xl border border-line-strong bg-[#f4f2ed]">
                                      <div className="flex items-center justify-between border-b border-line bg-[#ebe8e1] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                                        <span>
                                          {fn.file} (Lines {fn.startLine}–{fn.endLine})
                                        </span>
                                        <span>AST Extracted Source</span>
                                      </div>
                                      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-ink">
                                        <code>{fn.codeSnippet}</code>
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </section>
                    )}

                    {/* =================================================== */}
                    {/* CHAPTER 06: OUT-OF-THE-BOX DEVELOPER PLAYBOOK       */}
                    {/* =================================================== */}
                    <section
                      id="chap-playbook"
                      className="space-y-8 rounded-2xl border border-line-strong bg-surface p-7 md:p-9"
                    >
                      <div>
                        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                          Chapter 06 · Out-of-the-Box Developer Knowledge &amp; Onboarding Playbook
                        </div>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                          Environment Setup, Security Hardening, Extension Recipes &amp; Interview Q&amp;A
                        </h2>
                        <p className="mt-1 text-xs text-muted">
                          Essential engineering knowledge beyond the literal source code for new team members and students preparing for project reviews.
                        </p>
                      </div>

                      {/* 6A. Environment Variables Checklist */}
                      {detailedReport.outOfTheBoxPlaybook?.environmentVariables
                        ?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                            01 · Required Environment Variables &amp; Configuration
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {detailedReport.outOfTheBoxPlaybook.environmentVariables.map(
                              (env) => (
                                <div
                                  key={env.name}
                                  className="rounded-xl border border-line bg-paper p-4 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <code className="rounded bg-sunken px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                                      {env.name}
                                    </code>
                                    <span className="truncate font-mono text-[10.5px] text-muted">
                                      {(env.usedInFiles || []).join(", ")}
                                    </span>
                                  </div>
                                  <p className="text-xs leading-relaxed text-[#2b2923]">
                                    {env.purpose}
                                  </p>
                                  {env.exampleFormat && (
                                    <div className="font-mono text-[11px] text-muted">
                                      Example: <code>{env.exampleFormat}</code>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* 6B. Security, Edge Cases & Production Hardening Audit */}
                      {detailedReport.outOfTheBoxPlaybook?.securityAndEdgeCasesAudit
                        ?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                            02 · Security, Edge-Case &amp; Production Hardening Audit
                          </h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            {detailedReport.outOfTheBoxPlaybook.securityAndEdgeCasesAudit.map(
                              (sec, idx) => (
                                <div
                                  key={`${sec.fileAndFunction}-${idx}`}
                                  className="rounded-xl border border-line bg-paper p-5 space-y-2.5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="rounded bg-[#fbeae4] px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                                      {sec.severity} · {sec.category}
                                    </span>
                                    {sec.fileAndFunction && (
                                      <span className="font-mono text-[11px] text-ink">
                                        {sec.fileAndFunction}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13.5px] leading-relaxed text-[#2b2923]">
                                    <strong className="text-ink">Finding: </strong>
                                    {renderInlineMarkdown(sec.finding)}
                                  </p>
                                  <p className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-soft">
                                    <strong className="font-mono text-[10px] uppercase text-sage">
                                      Recommended Fix:{" "}
                                    </strong>
                                    {renderInlineMarkdown(sec.howToFix)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* 6C. How to Extend This Codebase */}
                      {detailedReport.outOfTheBoxPlaybook?.extensionPlaybook
                        ?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                            03 · Developer Extension Guide (How to Add New Features)
                          </h3>
                          <div className="space-y-4">
                            {detailedReport.outOfTheBoxPlaybook.extensionPlaybook.map(
                              (ext, idx) => (
                                <div
                                  key={`${ext.scenario}-${idx}`}
                                  className="rounded-xl border border-line bg-paper p-5 space-y-2.5"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-ink">
                                      {ext.scenario}
                                    </h4>
                                    {ext.filesToTouch?.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {ext.filesToTouch.map((ft) => (
                                          <span
                                            key={ft}
                                            className="rounded bg-sunken px-2 py-0.5 font-mono text-[10.5px] text-ink"
                                          >
                                            {ft}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-[13.5px] leading-[1.7] text-[#2b2923]">
                                    {renderInlineMarkdown(ext.stepByStepGuide)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* 6D. Technical Interview & Viva Q&A */}
                      {detailedReport.outOfTheBoxPlaybook?.interviewAndVivaQa
                        ?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                            04 · Technical Interview, Code Review &amp; Viva Q&amp;A
                          </h3>
                          <div className="space-y-4">
                            {detailedReport.outOfTheBoxPlaybook.interviewAndVivaQa.map(
                              (qa, idx) => (
                                <div
                                  key={`${qa.question}-${idx}`}
                                  className="rounded-xl border border-line bg-paper p-5 space-y-2.5"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <h4 className="text-[14.5px] font-semibold text-ink">
                                      Q{idx + 1}. {qa.question}
                                    </h4>
                                    {qa.keyFilesAndFunctions && (
                                      <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10.5px] text-accent">
                                        {qa.keyFilesAndFunctions}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[13.5px] leading-[1.72] text-[#2b2923]">
                                    {renderInlineMarkdown(qa.idealAnswer)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

export default function ProjectWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper font-mono text-xs text-muted">
          Loading AST Project Workspace…
        </div>
      }
    >
      <ProjectWorkspaceContent />
    </Suspense>
  );
}
