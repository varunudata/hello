"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
    sub: "Trace functions & workflows",
    badge: "SOON",
    active: false,
  },
  {
    id: "reports",
    num: "04",
    label: "Project Reports",
    sub: "Brief & deep developer audits",
    badge: "SOON",
    active: false,
  },
];

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

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  // Graph Explorer states
  const [selectedFnId, setSelectedFnId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("ALL");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let token = null;
    try {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get("tab");
      if (
        tabParam &&
        ["overview", "graph", "ask", "reports"].includes(tabParam)
      ) {
        setActiveSection(tabParam);
      }
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
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
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

  // Compute deterministic architectural graph layout for all functions
  const graphLayout = useMemo(() => {
    const fns = filteredFunctions;
    if (fns.length === 0) return { nodes: [], edges: [], width: 1000, height: 660 };

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
    };
  }, [filteredFunctions, allEdges, selectedFnId]);

  function openFunctionInGraph(fnId) {
    setSelectedFnId(fnId);
    setActiveSection("graph");
  }

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
        {/* SECTION 3: ASK CODEBASE (COMING SOON STATE)               */}
        {/* ========================================================= */}
        {activeSection === "ask" && (
          <main className="mx-auto w-full max-w-4xl p-8 md:py-14">
            <div className="rounded-2xl border border-line-strong bg-surface p-8 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-sunken px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Section 03 · Coming Soon
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Ask Any Question About {analysis.fullName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Graph-aware natural language codebase assistant is scheduled for
                the next phase. Once activated, you will be able to query the AST
                call graph directly to trace execution paths, inspect why
                specific dependencies are imported, and clarify complex
                workflows across all {analysis.fileCount} files.
              </p>

              {/* Preview of Capabilities */}
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-line bg-paper p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    01 · Function Tracing
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-ink">
                    Trace Execution Paths
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Follow how data flows from entry routes through middleware
                    and database transactions step by step.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-paper p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    02 · Dependency Context
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-ink">
                    Understand Dependencies
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Ask why any package or internal module is used and which
                    functions rely on it.
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-paper p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-accent">
                    03 · Workflow Clarification
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-ink">
                    Explain Unfamiliar Code
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Get plain-English explanations grounded in your live AST
                    graph rather than generic keyword search.
                  </p>
                </div>
              </div>

              {/* Disabled Preview Prompt Box */}
              <div className="mt-8 rounded-xl border border-line bg-sunken p-5">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Example Graph-Aware Queries (Preview)
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    `Trace the full execution flow of ${
                      allFunctions[0]?.name || "main"
                    }() across files`,
                    "Which functions break if we refactor the database transaction helper?",
                    "Explain how authentication and session verification work in this repo",
                  ].map((q) => (
                    <span
                      key={q}
                      className="rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-xs text-ink-soft"
                    >
                      “{q}”
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg border border-line-strong bg-paper px-4 py-3 text-xs text-faint">
                  <span className="font-mono">
                    Ask anything about {analysis.fullName} functions,
                    dependencies, or workflows…
                  </span>
                  <span className="rounded bg-sunken px-2.5 py-1 font-mono text-[10px] uppercase text-muted">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ========================================================= */}
        {/* SECTION 4: PROJECT REPORTS (COMING SOON STATE)            */}
        {/* ========================================================= */}
        {activeSection === "reports" && (
          <main className="mx-auto w-full max-w-5xl p-8 md:py-14">
            <div className="rounded-2xl border border-line-strong bg-surface p-8 md:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-sunken px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Section 04 · Coming Soon
              </div>

              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Automated Codebase & Architecture Reports
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Archon generates two distinct intelligence reports from your
                indexed AST graph: a concise{" "}
                <strong className="font-medium text-ink">
                  Brief Executive & Tech-Stack Summary
                </strong>{" "}
                and an exhaustive{" "}
                <strong className="font-medium text-ink">
                  Deep Developer Code & Dependency Audit Report
                </strong>
                . This module is marked as Coming Soon and will be unlocked in
                the next milestone.
              </p>

              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {/* Report Type 1: Brief & Executive Summary */}
                <div className="flex flex-col justify-between rounded-xl border border-line-strong bg-paper p-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                        Report Mode I · Brief Overview
                      </span>
                      <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                        Coming Soon
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-ink">
                      Executive & Product Tech-Stack Brief
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      Designed for rapid onboarding, product managers, and
                      architectural reviews to understand the repository at a
                      glance.
                    </p>

                    <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-xs text-ink-soft">
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">01</span>
                        <span>
                          <strong>What the Project Is & Problem Solved:</strong>{" "}
                          Clear synthesis of the application domain and core
                          capabilities.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">02</span>
                        <span>
                          <strong>Tech Stack & Runtime Architecture:</strong>{" "}
                          Languages ({analysis.primaryLanguage}), frameworks,
                          and system boundaries.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">03</span>
                        <span>
                          <strong>High-Level Health & Module Map:</strong>{" "}
                          Summary of {analysis.fileCount} files and{" "}
                          {analysis.functionCount} AST functions.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 rounded-lg border border-line bg-sunken px-4 py-2.5 text-center font-mono text-xs text-muted">
                    Brief Report Generator — Coming Soon
                  </div>
                </div>

                {/* Report Type 2: Deep Developer Audit */}
                <div className="flex flex-col justify-between rounded-xl border border-line-strong bg-paper p-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-accent">
                        Report Mode II · Deep Developer Audit
                      </span>
                      <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[10px] uppercase text-muted">
                        Coming Soon
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold text-ink">
                      Deep Function, Package & Workflow Analysis
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      Built for engineers who want to analyze every single line,
                      dependency version, and execution workflow in the
                      repository.
                    </p>

                    <ul className="mt-4 space-y-2.5 border-t border-line pt-4 text-xs text-ink-soft">
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">01</span>
                        <span>
                          <strong>Function-by-Function Deep Dive:</strong>{" "}
                          Signatures, cyclomatic complexity, callers, callees,
                          and exact blast radius across all{" "}
                          {analysis.functionCount} functions.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">02</span>
                        <span>
                          <strong>
                            Packages, Versions & Best Alternatives:
                          </strong>{" "}
                          Audit of all {analysis.packageCount} packages, their
                          versions, modern alternatives if any, or why the
                          current choice is optimal.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-mono text-accent">03</span>
                        <span>
                          <strong>Major Execution Workflows:</strong>{" "}
                          End-to-end call pipelines and architectural
                          bottlenecks every developer must know.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 rounded-lg border border-line bg-sunken px-4 py-2.5 text-center font-mono text-xs text-muted">
                    Deep Developer Report Generator — Coming Soon
                  </div>
                </div>
              </div>
            </div>
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
