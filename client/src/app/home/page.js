"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../../components/Logo";
import { API_BASE } from "../../lib/api";

const QUICK_REPOS = [
  {
    slug: "archon/self-workspace",
    title: "archon/self-workspace",
    tag: "Live Workspace Repo",
    lang: "JavaScript / Next.js",
    desc: "Parse this actual Archon codebase (Express, Prisma, Babel AST Engine & Next.js UI).",
  },
  {
    slug: "acme/storefront-api",
    title: "acme/storefront-api",
    tag: "TypeScript Reference",
    lang: "TypeScript",
    desc: "Commerce API with Stripe payments, Redis inventory locks, and order orchestration.",
  },
  {
    slug: "pallets/click",
    title: "pallets/click",
    tag: "GitHub Public Repo",
    lang: "Python",
    desc: "Python composable command line interface toolkit fetched live from GitHub.",
  },
];

const PIPELINE_STEPS = [
  "Fetching repository file tree & package manifests…",
  "Parsing functions & call expressions via @babel/parser AST…",
  "Mapping cross-file dependency graph & blast radius…",
  "Persisting indexed AST graph to Neon PostgreSQL…",
];

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [repoInput, setRepoInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let token = null;
    let savedUser = null;
    try {
      token = localStorage.getItem("archon_token");
      const rawUser = localStorage.getItem("archon_user");
      if (rawUser) savedUser = JSON.parse(rawUser);
    } catch {
      // ignore
    }

    if (!token) {
      router.replace("/login");
      return;
    }

    setUser(savedUser);
    fetchProjects(token);
  }, [router]);

  useEffect(() => {
    if (!analyzing) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((prev) =>
        prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 650);
    return () => clearInterval(interval);
  }, [analyzing]);

  async function fetchProjects(tokenOverride) {
    setLoadingProjects(true);
    try {
      const token =
        tokenOverride || localStorage.getItem("archon_token") || "";
      const res = await fetch(`${API_BASE}/api/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        localStorage.removeItem("archon_token");
        localStorage.removeItem("archon_user");
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (res.ok && Array.isArray(data.projects)) {
        setProjects(data.projects);
      }
    } catch {
      // ignore network error on initial load
    } finally {
      setLoadingProjects(false);
    }
  }

  async function handleAnalyzeRepo(e, presetSlug = null) {
    if (e) e.preventDefault();
    const target = (presetSlug || repoInput).trim();
    if (!target) {
      setError("Paste a GitHub repository URL or owner/repo slug to begin.");
      return;
    }

    setError("");
    setAnalyzing(true);
    try {
      const token = localStorage.getItem("archon_token") || "";
      const res = await fetch(`${API_BASE}/api/projects/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoUrl: target,
          preset: presetSlug || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Could not analyze repository.");
        setAnalyzing(false);
        return;
      }

      if (data?.project?.id) {
        router.push(`/projects/${data.project.id}`);
      } else {
        await fetchProjects(token);
        setAnalyzing(false);
      }
    } catch {
      setError(
        "Unable to reach the AST analysis server on port 4000. Verify the backend is running."
      );
      setAnalyzing(false);
    }
  }

  async function handleDeleteProject(e, id) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      const token = localStorage.getItem("archon_token") || "";
      const res = await fetch(`${API_BASE}/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  }

  function handleSignOut() {
    try {
      localStorage.removeItem("archon_token");
      localStorage.removeItem("archon_user");
    } catch {
      // ignore
    }
    router.push("/login");
  }

  function triggerNewProjectFocus() {
    setShowNewModal(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
  }

  const totalFunctions = projects.reduce(
    (acc, p) => acc + (p.functionCount || 0),
    0
  );
  const totalFiles = projects.reduce((acc, p) => acc + (p.fileCount || 0), 0);
  const totalDeps = projects.reduce(
    (acc, p) => acc + (p.dependencyCount || 0),
    0
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top Workspace Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/home" aria-label="Archon Workspace">
              <Logo />
            </Link>
            <span className="hidden h-4 w-px bg-line md:inline-block" />
            <div className="hidden items-center gap-2 font-mono text-xs text-muted md:flex">
              <span className="h-2 w-2 rounded-full bg-sage" />
              <span>WORKSPACE</span>
              <span className="text-faint">/</span>
              <span className="text-ink-soft">
                {user?.workspaceSlug || "engineering"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={triggerNewProjectFocus}
              className="inline-flex items-center gap-2 rounded-md bg-ink px-3.5 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              New project
            </button>

            <div className="hidden items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink-soft sm:flex">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                {user?.name || "Engineer"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-ink hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        {/* Workspace Hero & Connect Repository Section */}
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AST Codebase Intelligence Workspace
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Connect a repository to build its live AST function graph.
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
              Paste any GitHub repository URL or select a template below. Archon
              parses every file with{" "}
              <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-ink">
                @babel/parser
              </code>
              , extracts all functions and package dependencies, and computes the
              exact blast radius of modifying any function.
            </p>

            {/* Connect Repository Card */}
            <motion.div
              animate={
                showNewModal
                  ? { scale: [1, 1.01, 1], borderColor: "#c8502a" }
                  : {}
              }
              transition={{ duration: 0.4 }}
              onAnimationComplete={() => setShowNewModal(false)}
              className="mt-6 rounded-xl border border-line-strong bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <label
                  htmlFor="repo-url-input"
                  className="font-mono text-xs uppercase tracking-[0.12em] text-ink-soft"
                >
                  Connect GitHub Repository
                </label>
                <span className="font-mono text-[11px] text-muted">
                  AST Engine v2.4 · Babel + Tree-sitter
                </span>
              </div>

              <form
                onSubmit={(e) => handleAnalyzeRepo(e)}
                className="mt-3 flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-xs text-faint">
                    github.com/
                  </span>
                  <input
                    id="repo-url-input"
                    ref={inputRef}
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    disabled={analyzing}
                    placeholder="owner/repository or https://github.com/owner/repo"
                    className="h-11 w-full rounded-md border border-line-strong bg-paper pl-24 pr-3.5 font-mono text-sm text-ink placeholder:text-faint focus:border-ink focus:bg-surface focus:outline-none disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={analyzing}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft disabled:opacity-60"
                >
                  {analyzing ? (
                    <>
                      <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
                      Parsing AST…
                    </>
                  ) : (
                    <>
                      Connect & Analyze
                      <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </form>

              {error && (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-accent bg-paper px-3.5 py-2.5 text-xs text-accent"
                >
                  {error}
                </div>
              )}

              {/* Live AST Indexing Progress Banner */}
              <AnimatePresence>
                {analyzing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 overflow-hidden rounded-lg border border-line bg-sunken p-4"
                  >
                    <div className="flex items-center justify-between font-mono text-xs text-ink">
                      <span>{PIPELINE_STEPS[stepIndex]}</span>
                      <span className="text-accent">
                        STEP {stepIndex + 1} / {PIPELINE_STEPS.length}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {PIPELINE_STEPS.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1 rounded-full transition-colors duration-300 ${
                            idx <= stepIndex ? "bg-accent" : "bg-line-strong"
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Start Presets */}
              <div className="mt-5 border-t border-line pt-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                  Or instant-analyze a sample repository:
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {QUICK_REPOS.map((preset) => (
                    <button
                      key={preset.slug}
                      type="button"
                      disabled={analyzing}
                      onClick={() => {
                        setRepoInput(preset.slug);
                        handleAnalyzeRepo(null, preset.slug);
                      }}
                      className="group flex flex-col justify-between rounded-lg border border-line bg-paper p-3 text-left transition-colors hover:border-ink hover:bg-surface disabled:opacity-50"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                            {preset.tag}
                          </span>
                          <span className="font-mono text-[11px] text-muted group-hover:text-ink">
                            →
                          </span>
                        </div>
                        <div className="mt-1 truncate font-mono text-xs font-medium text-ink">
                          {preset.title}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
                          {preset.desc}
                        </p>
                      </div>
                      <div className="mt-2.5 font-mono text-[10px] text-faint">
                        {preset.lang}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Workspace Telemetry & Architecture Summary */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-line bg-sunken p-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    Workspace Telemetry
                  </div>
                  <div className="mt-1 text-base font-semibold text-ink">
                    Indexed Codebase Inventory
                  </div>
                </div>
                <span className="rounded border border-line-strong bg-surface px-2.5 py-1 font-mono text-[11px] text-sage">
                  NEON PG ACTIVE
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    My Projects
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-ink">
                    {projects.length}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Connected repositories
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    AST Functions
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-accent">
                    {totalFunctions}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Parsed & impact-scored
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Source Files
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-ink">
                    {totalFiles}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Indexed in call graph
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-surface p-4">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                    Dependencies
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-ink">
                    {totalDeps}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Cross-file & npm links
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-line bg-surface p-4">
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                  What happens when you open a project
                </div>
                <ul className="mt-2.5 space-y-2 text-xs text-muted">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 font-mono text-accent">01</span>
                    <span>
                      <strong className="font-medium text-ink">Overview:</strong>{" "}
                      Complete breakdown of files, functions, packages,
                      dependencies, and architectural health.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 font-mono text-accent">02</span>
                    <span>
                      <strong className="font-medium text-ink">
                        Graph Explorer:
                      </strong>{" "}
                      Click any AST-parsed function to inspect its size,
                      language, imports, blast radius, and criticality in the
                      left inspector popup.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 font-mono text-muted">03</span>
                    <span>
                      <strong className="font-medium text-ink">
                        Ask Codebase & Reports:
                      </strong>{" "}
                      Natural-language function tracing and executive/developer
                      audit reports (Coming Soon).
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* MY PROJECTS SECTION */}
        <section className="mt-14 border-t border-line pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                Saved in Workspace
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                My Projects
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted">
                {projects.length}{" "}
                {projects.length === 1 ? "repository" : "repositories"} indexed
              </span>
              <button
                type="button"
                onClick={triggerNewProjectFocus}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 py-2 text-xs font-medium text-ink transition-colors hover:border-ink"
              >
                <span>+ New project</span>
              </button>
            </div>
          </div>

          {loadingProjects ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-56 animate-pulse rounded-xl border border-line bg-sunken p-6"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="mt-6 rounded-xl border border-line-strong bg-surface p-10 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-sunken font-mono text-sm text-accent">
                AST
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">
                No repositories connected yet
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
                Connect your first GitHub repository above or click one of the
                sample presets to generate an interactive AST function graph.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleAnalyzeRepo(null, "archon/self-workspace")
                  }
                  className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink-soft"
                >
                  Analyze archon/self-workspace →
                </button>
                <button
                  type="button"
                  onClick={() => handleAnalyzeRepo(null, "acme/storefront-api")}
                  className="rounded-md border border-line-strong bg-paper px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-ink"
                >
                  Analyze acme/storefront-api
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group flex flex-col justify-between rounded-xl border border-line-strong bg-surface p-6 transition-all hover:border-ink"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-sage" />
                        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                          {project.primaryLanguage || "TypeScript"}
                        </span>
                        <span className="rounded bg-sunken px-2 py-0.5 font-mono text-[10px] text-ink-soft">
                          {project.defaultBranch || "main"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        disabled={deletingId === project.id}
                        title="Remove project"
                        className="rounded px-1.5 py-0.5 font-mono text-[11px] text-faint transition-colors hover:bg-sunken hover:text-accent"
                      >
                        {deletingId === project.id ? "…" : "Remove"}
                      </button>
                    </div>

                    <h3 className="mt-3 truncate font-mono text-base font-semibold text-ink group-hover:text-accent">
                      {project.fullName}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">
                      {project.description ||
                        "AST-indexed repository with full function call graph and blast radius metrics."}
                    </p>

                    {/* 4 Key Metrics Grid */}
                    <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg border border-line bg-paper p-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted">
                          Files
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-ink">
                          {project.fileCount}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted">
                          Funcs
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-accent">
                          {project.functionCount}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted">
                          Pkgs
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-ink">
                          {project.packageCount}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase text-muted">
                          Deps
                        </div>
                        <div className="mt-0.5 font-mono text-sm font-semibold text-ink">
                          {project.dependencyCount}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                    <div className="font-mono text-[11px] text-muted">
                      Health{" "}
                      <span className="font-semibold text-ink">
                        {project.healthScore || 92}%
                      </span>{" "}
                      · {(project.totalLines || 0).toLocaleString()} LOC
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono text-xs font-medium text-ink group-hover:text-accent">
                      Open project
                      <span
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

