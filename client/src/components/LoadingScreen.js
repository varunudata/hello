"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { LogoMark } from "./Logo";

// Ensure GSAP always stays synchronized with wall-clock time
if (typeof window !== "undefined") {
  gsap.ticker.lagSmoothing(0);
}

const STORY_DURATION_MS = 5000;

const PHASES = [
  {
    id: "01",
    num: "01",
    badge: "01 / Upload, not configure",
    eyebrow: "WHAT WE DO — STRUCTURED CODEBASE GRAPH",
    headlineWords: [
      { text: "We", accent: false },
      { text: "don't", accent: false },
      { text: "treat", accent: false },
      { text: "code", accent: true },
      { text: "as", accent: false },
      { text: "text.", accent: true },
      { text: "Zero", accent: false },
      { text: "setup.", accent: false },
    ],
    sublineLines: [
      "Paste a GitHub link or drag in a repository — Archon",
      "ingests your project in seconds with zero configuration.",
    ],
    status: "REPOSITORY INGESTED · 1,284 FILES QUEUED · ZERO CONFIG",
    insights: [
      { label: "Ingestion mode", value: "GitHub / Drag & Drop", tone: "text-ink" },
      { label: "Files detected", value: "1,284 files", tone: "text-ink" },
      { label: "Setup time", value: "0 config files", tone: "text-[#1e7a34]" },
    ],
  },
  {
    id: "02",
    num: "02",
    badge: "02 / Parse, not read",
    eyebrow: "TREE-SITTER AST EXTRACTION",
    headlineWords: [
      { text: "Tree-sitter", accent: true },
      { text: "extracts", accent: false },
      { text: "every", accent: false },
      { text: "function,", accent: true },
      { text: "class,", accent: true },
      { text: "and", accent: false },
      { text: "import.", accent: true },
    ],
    sublineLines: [
      "Every file is converted into syntax trees automatically,",
      "capturing exact call signatures and module boundaries.",
    ],
    status: "TREE-SITTER PARSED · 3,410 FUNCTIONS · 8,920 IMPORTS",
    insights: [
      { label: "Parser engine", value: "Tree-sitter AST", tone: "text-ink" },
      { label: "Extracted symbols", value: "3,410 functions", tone: "text-ink" },
      { label: "Languages", value: "TS · JS · Py · Go", tone: "text-muted" },
    ],
  },
  {
    id: "03",
    num: "03",
    badge: "03 / Graph, not list",
    eyebrow: "I. FUNCTION TRACING & II. DEPENDENCY GRAPH",
    headlineWords: [
      { text: "Relationships", accent: true },
      { text: "mapped", accent: false },
      { text: "into", accent: false },
      { text: "a", accent: false },
      { text: "live", accent: true },
      { text: "dependency", accent: true },
      { text: "graph.", accent: true },
    ],
    sublineLines: [
      "Follow execution paths visually across your codebase",
      "and spot architectural bottlenecks or blast radius.",
    ],
    status: "STRUCTURED GRAPH BUILT · 14 EXECUTION PATHS TRACED",
    insights: [
      { label: "Execution trace", value: "checkout → payments → db", tone: "text-ink" },
      { label: "Bottleneck found", value: "payments.ts (CC 46)", tone: "text-[#9a6200]" },
      { label: "Circular imports", value: "orders ⇄ inventory", tone: "text-[#b42318]" },
    ],
  },
  {
    id: "04",
    num: "04",
    badge: "04 / Ask, not search",
    eyebrow: "III. GRAPH-AWARE AI & IMPACT ANALYSIS",
    headlineWords: [
      { text: "Ask", accent: true },
      { text: "in", accent: false },
      { text: "plain", accent: true },
      { text: "English.", accent: true },
      { text: "Simulate", accent: false },
      { text: "impact", accent: true },
      { text: "instantly.", accent: false },
    ],
    sublineLines: [
      "Natural language queries answered with graph-aware AI",
      "and simulated blast-radius impact assessments.",
    ],
    status: "GRAPH-AWARE AI READY · 3 UPSTREAM CALLERS SIMULATED",
    insights: [
      { label: "Target change", value: "services/payments.ts", tone: "text-ink" },
      { label: "Blast radius", value: "checkout, orders, db", tone: "text-accent" },
      { label: "AI explanation", value: "Graph-verified", tone: "text-[#1e7a34]" },
    ],
  },
];

const PILLARS = [
  {
    title: "Upload, not configure.",
    desc: "Paste a GitHub link or drag in a repo, zero setup.",
    step: 0,
  },
  {
    title: "Parse, not read.",
    desc: "Tree-sitter extracts every function, class, import automatically.",
    step: 1,
  },
  {
    title: "Graph, not list.",
    desc: "Relationships are mapped into a live dependency graph.",
    step: 2,
  },
  {
    title: "Ask, not search.",
    desc: "Natural language queries answered with graph-aware AI.",
    step: 3,
  },
];

const STORY_NODES = [
  {
    id: "checkout",
    folder: "routes/",
    name: "checkout.ts",
    meta: "184L · CC 18",
    initialPos: { x: 42, y: 24, rotate: -4 },
    mappedPos: { x: 24, y: 28, rotate: 0 },
    impacted: true,
    inCycle: false,
    dot: "#e8a317",
  },
  {
    id: "orders",
    folder: "routes/",
    name: "orders.ts",
    meta: "126L · CC 9",
    initialPos: { x: 64, y: 120, rotate: 3 },
    mappedPos: { x: 24, y: 104, rotate: 0 },
    impacted: true,
    inCycle: true,
    dot: "#2f9e44",
  },
  {
    id: "auth",
    folder: "routes/",
    name: "auth.ts",
    meta: "158L · CC 14",
    initialPos: { x: 20, y: 188, rotate: -3 },
    mappedPos: { x: 24, y: 180, rotate: 0 },
    impacted: false,
    inCycle: false,
    dot: "#2f9e44",
  },
  {
    id: "payments",
    folder: "services/",
    name: "payments.ts",
    meta: "412L · CC 46",
    initialPos: { x: 238, y: 148, rotate: 4 },
    mappedPos: { x: 214, y: 62, rotate: 0 },
    focal: true,
    impacted: true,
    inCycle: false,
    dot: "#d6453d",
  },
  {
    id: "inventory",
    folder: "services/",
    name: "inventory.ts",
    meta: "231L · CC 22",
    initialPos: { x: 206, y: 34, rotate: -4 },
    mappedPos: { x: 214, y: 148, rotate: 0 },
    impacted: false,
    inCycle: true,
    dot: "#e8a317",
  },
  {
    id: "db",
    folder: "lib/",
    name: "db.ts",
    meta: "64L · 14 refs",
    initialPos: { x: 408, y: 38, rotate: 3 },
    mappedPos: { x: 404, y: 62, rotate: 0 },
    impacted: true,
    inCycle: false,
    dot: "#2f9e44",
  },
  {
    id: "logger",
    folder: "lib/",
    name: "logger.ts",
    meta: "41L · 11 refs",
    initialPos: { x: 392, y: 168, rotate: -3 },
    mappedPos: { x: 404, y: 148, rotate: 0 },
    impacted: false,
    inCycle: false,
    dot: "#2f9e44",
  },
];

const STORY_EDGES = [
  { id: "e1", d: "M162 50 C188 50 188 84 214 84", impact: true, cycle: false },
  { id: "e2", d: "M162 126 C188 126 188 84 214 84", impact: true, cycle: false },
  { id: "e3", d: "M162 126 C188 126 188 170 214 170", impact: false, cycle: true },
  { id: "e4", d: "M162 202 C188 202 188 170 214 170", impact: false, cycle: false },
  { id: "e5", d: "M352 84 C378 84 378 84 404 84", impact: true, cycle: false },
  { id: "e6", d: "M352 84 C378 84 378 170 404 170", impact: false, cycle: false },
  { id: "e7", d: "M352 170 C378 170 378 84 404 84", impact: false, cycle: false },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_#<>";

export default function LoadingScreen({ onComplete }) {
  const [elapsed, setElapsed] = useState(0);
  const [unmounted, setUnmounted] = useState(false);

  const rootRef = useRef(null);
  const topBarRef = useRef(null);
  const leftColRef = useRef(null);
  const rightCardRef = useRef(null);
  const curtainColsRef = useRef([]);
  const eyebrowRef = useRef(null);
  const wordRefs = useRef([]);
  const underlineRefs = useRef([]);
  const sublineRefs = useRef([]);
  const insightValueRefs = useRef([]);
  const insightLabelRefs = useRef([]);
  const statusTextRef = useRef(null);
  const svgNodeRefs = useRef([]);
  const exitStartedRef = useRef(false);
  const onCompleteCalledRef = useRef(false);

  const phaseIndex =
    elapsed < 1200 ? 0 : elapsed < 2450 ? 1 : elapsed < 3700 ? 2 : 3;
  const phase = PHASES[phaseIndex];

  const isMapped = elapsed >= 650;
  const showHealth = phaseIndex === 2;
  const showImpact = phaseIndex === 3;

  // Multi-stage ultra-smooth GSAP exit choreography (~1.45s)
  const triggerSmoothExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;

    const finishAll = () => {
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true;
        if (onComplete) onComplete();
      }
      setUnmounted(true);
    };

    const safetyTimer = setTimeout(finishAll, 1650);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          clearTimeout(safetyTimer);
          finishAll();
        },
      });

      const validWords = wordRefs.current.filter(Boolean);
      const validSublines = sublineRefs.current.filter(Boolean);

      if (validWords.length) {
        tl.to(
          validWords,
          {
            yPercent: -120,
            rotateZ: -3,
            skewX: 6,
            duration: 0.55,
            stagger: 0.018,
            ease: "power3.inOut",
          },
          0
        );
      }

      if (validSublines.length) {
        tl.to(
          validSublines,
          {
            yPercent: -115,
            opacity: 0,
            duration: 0.5,
            stagger: 0.06,
            ease: "power3.inOut",
          },
          0.06
        );
      }

      if (topBarRef.current) {
        tl.to(
          topBarRef.current,
          {
            y: -28,
            opacity: 0,
            duration: 0.55,
            ease: "power3.inOut",
          },
          0.05
        );
      }

      if (leftColRef.current) {
        tl.to(
          leftColRef.current,
          {
            y: -24,
            opacity: 0,
            duration: 0.6,
            ease: "power3.inOut",
          },
          0.12
        );
      }

      if (rightCardRef.current) {
        tl.to(
          rightCardRef.current,
          {
            y: -32,
            scale: 0.96,
            opacity: 0,
            duration: 0.68,
            ease: "expo.inOut",
          },
          0.1
        );
      }

      tl.call(
        () => {
          if (!onCompleteCalledRef.current) {
            onCompleteCalledRef.current = true;
            if (onComplete) onComplete();
          }
        },
        null,
        0.82
      );

      const cols = curtainColsRef.current.filter(Boolean);
      if (cols.length) {
        tl.to(
          cols,
          {
            yPercent: -102,
            duration: 1.05,
            stagger: 0.065,
            ease: "expo.inOut",
          },
          0.38
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, [onComplete]);

  // GSAP SVG Graph Node Positioning & Highlighting
  useEffect(() => {
    if (exitStartedRef.current) return;

    const ctx = gsap.context(() => {
      STORY_NODES.forEach((n, idx) => {
        const el = svgNodeRefs.current[idx];
        if (!el) return;
        const pos = isMapped ? n.mappedPos : n.initialPos;
        const dimmed =
          (showImpact && !n.impacted) ||
          (showHealth && !n.inCycle && !n.focal);

        gsap.to(el, {
          attr: {
            transform: `translate(${pos.x}, ${pos.y}) rotate(${pos.rotate})`,
          },
          opacity: dimmed ? 0.38 : 1,
          duration: 0.65,
          ease: "expo.out",
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [isMapped, showHealth, showImpact]);

  // Phase-driven GSAP typography choreography
  useEffect(() => {
    if (exitStartedRef.current) return;

    const ctx = gsap.context(() => {
      if (eyebrowRef.current) {
        const targetText = phase.eyebrow;
        const progressObj = { p: 0 };
        gsap.fromTo(
          eyebrowRef.current,
          { x: -14, opacity: 0.4 },
          { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" }
        );
        gsap.to(progressObj, {
          p: 1,
          duration: 0.55,
          ease: "power2.out",
          onUpdate: () => {
            if (!eyebrowRef.current) return;
            const revealCount = Math.floor(progressObj.p * targetText.length);
            let out = "";
            for (let i = 0; i < targetText.length; i++) {
              if (targetText[i] === " " || targetText[i] === "—") {
                out += targetText[i];
              } else if (i <= revealCount) {
                out += targetText[i];
              } else {
                out += GLYPHS[(i + Math.floor(progressObj.p * 24)) % GLYPHS.length];
              }
            }
            eyebrowRef.current.textContent = out;
          },
        });
      }

      const validWords = wordRefs.current.filter(Boolean);
      if (validWords.length) {
        gsap.fromTo(
          validWords,
          {
            yPercent: 118,
            x: (i) => (i % 2 === 0 ? -10 : 12),
            rotateZ: (i) => (i % 2 === 0 ? 3.5 : -2.5),
            skewX: -8,
            opacity: 0,
          },
          {
            yPercent: 0,
            x: 0,
            rotateZ: 0,
            skewX: 0,
            opacity: 1,
            duration: 0.72,
            stagger: 0.028,
            ease: "expo.out",
          }
        );
      }

      const validUnderlines = underlineRefs.current.filter(Boolean);
      if (validUnderlines.length) {
        gsap.fromTo(
          validUnderlines,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.65,
            delay: 0.18,
            stagger: 0.05,
            ease: "expo.out",
          }
        );
      }

      const validSublines = sublineRefs.current.filter(Boolean);
      if (validSublines.length) {
        gsap.fromTo(
          validSublines,
          {
            yPercent: 105,
            x: (i) => (i === 0 ? 18 : -18),
            opacity: 0,
          },
          {
            yPercent: 0,
            x: 0,
            opacity: 1,
            duration: 0.68,
            delay: 0.12,
            stagger: 0.07,
            ease: "power4.out",
          }
        );
      }

      const validLabels = insightLabelRefs.current.filter(Boolean);
      const validValues = insightValueRefs.current.filter(Boolean);

      if (validLabels.length) {
        gsap.fromTo(
          validLabels,
          { x: -12, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.45,
            stagger: 0.05,
            ease: "power3.out",
          }
        );
      }

      if (validValues.length) {
        gsap.fromTo(
          validValues,
          { yPercent: 110, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.06,
            ease: "expo.out",
          }
        );
      }

      if (statusTextRef.current) {
        const targetStatus = phase.status;
        const state = { p: 0 };
        gsap.fromTo(
          statusTextRef.current,
          { opacity: 0.3 },
          { opacity: 1, duration: 0.3, ease: "power2.out" }
        );
        gsap.to(state, {
          p: 1,
          duration: 0.5,
          ease: "power2.out",
          onUpdate: () => {
            if (!statusTextRef.current) return;
            const count = Math.floor(state.p * targetStatus.length);
            statusTextRef.current.textContent =
              targetStatus.slice(0, count) +
              (count < targetStatus.length ? "▌" : "");
          },
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, [phaseIndex, phase]);

  // Master timer driving the 4 phases and launching the smooth GSAP exit
  useEffect(() => {
    const startedAt = Date.now();

    const interval = setInterval(() => {
      const now = Date.now() - startedAt;
      if (now >= STORY_DURATION_MS) {
        setElapsed(STORY_DURATION_MS);
        clearInterval(interval);
      } else {
        setElapsed(now);
      }
    }, 40);

    const exitTimer = setTimeout(() => {
      triggerSmoothExit();
    }, STORY_DURATION_MS);

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        clearInterval(interval);
        clearTimeout(exitTimer);
        triggerSmoothExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      clearInterval(interval);
      clearTimeout(exitTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [triggerSmoothExit]);

  if (unmounted) return null;

  wordRefs.current = [];
  underlineRefs.current = [];
  sublineRefs.current = [];
  insightValueRefs.current = [];
  insightLabelRefs.current = [];

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden select-none px-6 py-7 sm:px-10 sm:py-9"
    >
      {/* 5 Architectural Warm-Paper Curtain Columns for Ultra-Smooth Staggered Reveal */}
      <div
        className="pointer-events-none absolute inset-0 grid grid-cols-5"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((colIdx) => (
          <div
            key={colIdx}
            ref={(el) => (curtainColsRef.current[colIdx] = el)}
            className="h-full w-full border-r border-line/35 bg-paper last:border-r-0"
          />
        ))}
      </div>

      {/* Top Header Bar */}
      <div
        ref={topBarRef}
        className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Archon
          </span>
          <span className="hidden rounded border border-line bg-sunken px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted sm:inline-block">
            Graph-Aware Codebase AI
          </span>
        </div>

        {/* 4 Step Pills */}
        <div className="hidden items-center gap-2 lg:flex">
          {PHASES.map((p, idx) => {
            const active = idx === phaseIndex;
            const completed = idx < phaseIndex;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1 text-[12px] ${
                  active
                    ? "border-ink bg-ink text-paper font-medium"
                    : completed
                    ? "border-line bg-sunken text-ink-soft"
                    : "border-line bg-surface text-faint"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active
                      ? "bg-accent"
                      : completed
                      ? "bg-[#2f9e44]"
                      : "bg-line-strong"
                  }`}
                />
                <span>{p.badge}</span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={triggerSmoothExit}
          className="cursor-pointer rounded-md border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Skip [ESC]
        </button>
      </div>

      {/* Center Stage: GSAP Kinetic Typography + Live Architecture Workbench */}
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-6xl items-center gap-8 py-4 lg:grid-cols-12 lg:gap-12">
        {/* Left 5 Columns: GSAP Typography + 4 Core Platform Pillars */}
        <div ref={leftColRef} className="lg:col-span-5">
          <div className="overflow-hidden">
            <p
              ref={eyebrowRef}
              className="font-mono text-[11.5px] font-medium tracking-[0.08em] text-accent"
            >
              {phase.eyebrow}
            </p>
          </div>

          {/* Split-Word Masked Headline */}
          <h1
            aria-label={phase.headlineWords.map((w) => w.text).join(" ")}
            className="mt-3 flex flex-wrap gap-x-[0.28em] gap-y-1 text-[30px] font-medium leading-[1.08] tracking-[-0.038em] text-ink sm:text-[36px]"
          >
            {phase.headlineWords.map((wordObj, wIdx) => (
              <span
                key={`${phase.id}-w-${wIdx}`}
                className="relative inline-block overflow-hidden py-0.5"
              >
                <span
                  ref={(el) => (wordRefs.current[wIdx] = el)}
                  className="inline-block text-ink will-change-transform"
                >
                  {wordObj.text}
                </span>
                {wordObj.accent && (
                  <span
                    ref={(el) => underlineRefs.current.push(el)}
                    className="absolute bottom-0.5 left-0 h-[2px] w-full bg-accent/80"
                  />
                )}
              </span>
            ))}
          </h1>

          {/* Opposite-Direction Masked Subline Lines */}
          <div className="mt-3.5 space-y-1">
            {phase.sublineLines.map((line, lIdx) => (
              <div key={`${phase.id}-line-${lIdx}`} className="overflow-hidden">
                <p
                  ref={(el) => (sublineRefs.current[lIdx] = el)}
                  className="text-[14.5px] leading-relaxed text-muted will-change-transform"
                >
                  {line}
                </p>
              </div>
            ))}
          </div>

          {/* 4 How It Works Pillars */}
          <div className="mt-6 space-y-2 border-t border-line pt-5">
            {PILLARS.map((item) => {
              const active = phaseIndex === item.step;
              const done = phaseIndex > item.step;
              return (
                <div
                  key={item.title}
                  className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 transition-all duration-300 ${
                    active
                      ? "border-line-strong bg-surface shadow-[0_1px_2px_rgba(26,25,21,0.05)]"
                      : done
                      ? "border-line bg-surface/60 opacity-85"
                      : "border-transparent bg-transparent opacity-45"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        active
                          ? "bg-accent"
                          : done
                          ? "bg-[#2f9e44]"
                          : "bg-line-strong"
                      }`}
                    />
                    <div>
                      <p className="text-[13.5px] font-medium text-ink">
                        {item.title}
                      </p>
                      <p className="text-[12px] text-muted">{item.desc}</p>
                    </div>
                  </div>
                  {(active || done) && (
                    <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 font-mono text-[10px] text-muted">
                      {done ? "Done" : "Active"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 7 Columns: Animated Architecture Workbench + Metrics */}
        <div ref={rightCardRef} className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(26,25,21,0.04),0_24px_48px_-24px_rgba(26,25,21,0.16)]">
            {/* Window Header */}
            <div className="flex h-10 items-center justify-between border-b border-line bg-paper/70 px-4 text-[12px]">
              <div className="flex items-center gap-2">
                <span className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                </span>
                <span className="ml-1 font-mono text-muted">
                  acme /{" "}
                  <strong className="font-sans font-medium text-ink">
                    storefront-api
                  </strong>
                </span>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                  phaseIndex === 0
                    ? "bg-sunken text-ink-soft"
                    : phaseIndex === 1
                    ? "bg-[#e9f5ec] text-[#1e7a34]"
                    : phaseIndex === 2
                    ? "bg-[#fdf3e1] text-[#9a6200]"
                    : "bg-accent-soft text-accent"
                }`}
              >
                {phaseIndex === 0 && "Ingesting repository..."}
                {phaseIndex === 1 && "Tree-sitter parsing AST..."}
                {phaseIndex === 2 && "Live dependency graph mapped"}
                {phaseIndex === 3 && "Impact simulation ready"}
              </span>
            </div>

            {/* Architectural Layer Header */}
            <div className="grid grid-cols-3 border-b border-line px-6 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
              <span>Routes (Entry)</span>
              <span className="text-center">Business Services</span>
              <span className="text-right">Core / Database</span>
            </div>

            {/* Animated Graph Canvas */}
            <div className="relative px-2 py-2">
              <svg
                viewBox="0 0 564 236"
                className="block h-auto w-full"
                aria-label="Animated codebase map"
              >
                <defs>
                  <pattern
                    id="intro-dots"
                    width="16"
                    height="16"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="1" cy="1" r="0.9" fill="#e7e5e0" />
                  </pattern>
                </defs>

                <rect width="564" height="236" fill="url(#intro-dots)" />

                {/* Dependency Curves */}
                {isMapped &&
                  STORY_EDGES.map((edge) => {
                    const isCycleEdge = showHealth && edge.cycle;
                    const isImpactEdge = showImpact && edge.impact;
                    const emphasized = isCycleEdge || isImpactEdge;

                    return (
                      <g key={edge.id}>
                        <path
                          d={edge.d}
                          fill="none"
                          stroke={
                            isCycleEdge
                              ? "#d6453d"
                              : isImpactEdge
                              ? "#c8502a"
                              : "#cbc7be"
                          }
                          strokeWidth={emphasized ? 2 : 1.3}
                          opacity={
                            (showHealth || showImpact) && !emphasized ? 0.35 : 1
                          }
                        />
                        {emphasized && (
                          <path
                            d={edge.d}
                            fill="none"
                            stroke={isCycleEdge ? "#d6453d" : "#c8502a"}
                            strokeWidth="2.2"
                            strokeDasharray="5 7"
                          />
                        )}
                      </g>
                    );
                  })}

                {/* Module Nodes (Driven by GSAP) */}
                {STORY_NODES.map((n, idx) => {
                  const pos = isMapped ? n.mappedPos : n.initialPos;
                  const isFocal = showImpact && n.focal;
                  const isAffected =
                    (showImpact && n.impacted) || (showHealth && n.inCycle);

                  return (
                    <g
                      key={n.id}
                      ref={(el) => (svgNodeRefs.current[idx] = el)}
                      transform={`translate(${pos.x}, ${pos.y}) rotate(${pos.rotate})`}
                    >
                      <rect
                        width="138"
                        height="44"
                        rx="7"
                        fill={isFocal ? "#1a1915" : "#ffffff"}
                        stroke={
                          isFocal
                            ? "#1a1915"
                            : isAffected
                            ? "#c8502a"
                            : "#d5d2ca"
                        }
                        strokeWidth={isFocal || isAffected ? "1.6" : "1"}
                      />
                      <text
                        x="11"
                        y="16"
                        fontSize="9.5"
                        className="font-mono"
                        fill="#9d9a91"
                      >
                        {n.folder}
                      </text>
                      <text
                        x="11"
                        y="31"
                        fontSize="12"
                        fontWeight="500"
                        className="font-sans"
                        fill={isFocal ? "#fafaf8" : "#1a1915"}
                      >
                        {n.name}
                      </text>
                      <text
                        x="128"
                        y="16"
                        textAnchor="end"
                        fontSize="8.5"
                        className="font-mono"
                        fill="#9d9a91"
                      >
                        {n.meta}
                      </text>
                      <circle cx="124" cy="29" r="3.2" fill={n.dot} />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* GSAP 3-Column Telemetry Strip */}
            <div className="grid grid-cols-3 divide-x divide-line border-t border-line bg-paper/50">
              {phase.insights.map((item, iIdx) => (
                <div key={item.label} className="overflow-hidden px-3.5 py-2.5">
                  <p
                    ref={(el) => (insightLabelRefs.current[iIdx] = el)}
                    className="text-[10.5px] uppercase tracking-[0.05em] text-faint will-change-transform"
                  >
                    {item.label}
                  </p>
                  <div className="mt-0.5 overflow-hidden">
                    <p
                      ref={(el) => (insightValueRefs.current[iIdx] = el)}
                      className={`truncate font-mono text-[12px] font-medium will-change-transform ${item.tone}`}
                    >
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Decoded Monospace Status Bar */}
            <div className="flex items-center justify-between border-t border-line bg-sunken/60 px-4 py-2 font-mono text-[11px] tracking-[0.04em] text-muted">
              <span ref={statusTextRef}>{phase.status}</span>
              <span className="text-accent">TREE-SITTER + GRAPH AI</span>
            </div>
          </div>
        </div>
      </div>

      {/* Clean Spacer Footer */}
      <div className="relative z-10 h-2" aria-hidden="true" />
    </div>
  );
}
