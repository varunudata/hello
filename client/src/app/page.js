"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductPreview from "../components/ProductPreview";
import FeatureTabs from "../components/FeatureTabs";
import LoadingScreen from "../components/LoadingScreen";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  gsap.ticker.lagSmoothing(0);
}

const LANGUAGES = [
  { name: "TypeScript", ext: ".ts" },
  { name: "JavaScript", ext: ".js" },
  { name: "Python", ext: ".py" },
  { name: "Go", ext: ".go" },
  { name: "Rust", ext: ".rs" },
  { name: "Java", ext: ".java" },
];

const HERO_WORDS = [
  { text: "Understand", accent: false },
  { text: "any", accent: true },
  { text: "codebase.", accent: true },
  { text: "Instantly.", accent: true },
];

const STATEMENT_WORDS = [
  { text: "We", highlight: false, muted: false },
  { text: "don't", highlight: false, muted: false },
  { text: "treat", highlight: false, muted: false },
  { text: "code", highlight: true, muted: false },
  { text: "as", highlight: false, muted: false },
  { text: "text.", highlight: true, muted: false },
  { text: "We", highlight: false, muted: false },
  { text: "convert", highlight: false, muted: false },
  { text: "it", highlight: false, muted: false },
  { text: "into", highlight: false, muted: false },
  { text: "a", highlight: false, muted: false },
  { text: "structured", highlight: true, muted: false },
  { text: "graph", highlight: true, muted: false },
  { text: "of", highlight: false, muted: false },
  { text: "relationships,", highlight: true, muted: false },
  { text: "then", highlight: false, muted: true },
  { text: "use", highlight: false, muted: true },
  { text: "AI", highlight: false, muted: true },
  { text: "to", highlight: false, muted: true },
  { text: "generate", highlight: false, muted: true },
  { text: "meaningful", highlight: false, muted: true },
  { text: "explanations.", highlight: false, muted: true },
];

const WHY_DIFFERENT = [
  {
    roman: "I",
    tag: "EXECUTION PATHS",
    title: "Function Tracing",
    body: "Follow execution paths visually through your entire codebase without losing cognitive focus.",
    preview: (
      <div className="mt-6 rounded-lg border border-line bg-surface p-3.5 font-mono text-[11.5px]">
        <div className="flex items-center justify-between text-[10.5px] text-faint">
          <span>EXECUTION TRACE</span>
          <span className="text-[#1e7a34]">4 hops · 0 context switches</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-ink">
          <span className="rounded bg-sunken px-2 py-0.5">POST /checkout</span>
          <span className="text-accent">→</span>
          <span className="rounded bg-sunken px-2 py-0.5">createOrder()</span>
          <span className="text-accent">→</span>
          <span className="rounded bg-ink px-2 py-0.5 text-paper">
            chargeCard()
          </span>
        </div>
      </div>
    ),
  },
  {
    roman: "II",
    tag: "BLAST RADIUS & BOTTLENECKS",
    title: "Dependency Graph",
    body: "See the blast radius of any change before making it. Instantly locate architectural bottlenecks.",
    preview: (
      <div className="mt-6 rounded-lg border border-line bg-surface p-3.5 font-mono text-[11.5px]">
        <div className="flex items-center justify-between text-[10.5px] text-faint">
          <span>BOTTLENECK DETECTED</span>
          <span className="text-[#b42318]">CC: 46 · High coupling</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between rounded bg-accent-soft px-2.5 py-1.5 text-accent">
          <span className="font-medium">services/payments.ts</span>
          <span>14 callers affected</span>
        </div>
      </div>
    ),
  },
  {
    roman: "III",
    tag: "PLAIN-ENGLISH SIMULATION",
    title: "Impact Analysis",
    body: "Query potential changes in plain English and get simulated impact assessments instantly.",
    preview: (
      <div className="mt-6 rounded-lg border border-line bg-surface p-3.5 text-[12px]">
        <p className="font-mono text-[11px] text-ink">
          “What breaks if we change PaymentIntent?”
        </p>
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[11px] text-muted">
          <span>Simulated impact:</span>
          <span className="font-medium text-accent">
            3 services · 2 routes · 4 tests
          </span>
        </div>
      </div>
    ),
  },
];

const FAQS = [
  {
    q: "How does Tree-sitter parsing make Archon different?",
    a: "Instead of treating code as raw text or relying on regex search, Archon uses Tree-sitter to build concrete syntax trees — extracting every function, class, call expression, and import with compiler-grade accuracy.",
  },
  {
    q: "Which languages does Archon support?",
    a: "TypeScript and JavaScript are fully supported along with Python, Go, Rust, and Java for AST extraction, dependency graphing, and function tracing.",
  },
  {
    q: "Do you keep a copy of my source code?",
    a: "No. Archon parses your repository in an isolated sandbox to build the structured relationship graph and then deletes the raw source files.",
  },
  {
    q: "How does 'Ask, not search' work?",
    a: "Standard search only matches keywords. Archon feeds your live dependency graph and function call chains into graph-aware AI so it can explain execution flows and simulate the blast radius of proposed changes.",
  },
  {
    q: "Is it really free to try without a credit card?",
    a: "Yes. You can create a free account and start exploring repositories, tracing functions, and running impact analysis right away with no credit card required.",
  },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_#<>";

// Reusable GSAP Split-Word + Decoded Eyebrow Section Heading
function SectionHeading({ eyebrow, title, children }) {
  const containerRef = useRef(null);
  const eyebrowRef = useRef(null);
  const wordRefs = useRef([]);
  const subRef = useRef(null);
  const lineRef = useRef(null);

  const words = title.split(" ");
  wordRefs.current = [];

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 84%",
          toggleActions: "play none none none",
        },
      });

      if (lineRef.current) {
        tl.fromTo(
          lineRef.current,
          { scaleX: 0, transformOrigin: "left center" },
          { scaleX: 1, duration: 0.85, ease: "expo.out" },
          0
        );
      }

      if (eyebrowRef.current) {
        const target = eyebrow.toUpperCase();
        const state = { p: 0 };
        tl.fromTo(
          eyebrowRef.current,
          { x: -12, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" },
          0.05
        );
        tl.to(
          state,
          {
            p: 1,
            duration: 0.55,
            ease: "power2.out",
            onUpdate: () => {
              if (!eyebrowRef.current) return;
              const count = Math.floor(state.p * target.length);
              let str = "";
              for (let i = 0; i < target.length; i++) {
                if (target[i] === " " || target[i] === "'") str += target[i];
                else if (i <= count) str += target[i];
                else str += GLYPHS[(i + Math.floor(state.p * 20)) % GLYPHS.length];
              }
              eyebrowRef.current.textContent = str;
            },
          },
          0.05
        );
      }

      const validWords = wordRefs.current.filter(Boolean);
      if (validWords.length) {
        tl.fromTo(
          validWords,
          {
            yPercent: 120,
            rotateZ: (i) => (i % 2 === 0 ? 3 : -2.5),
            skewX: -7,
            opacity: 0,
          },
          {
            yPercent: 0,
            rotateZ: 0,
            skewX: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.035,
            ease: "expo.out",
          },
          0.1
        );
      }

      if (subRef.current) {
        tl.fromTo(
          subRef.current,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          0.28
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [eyebrow, title]);

  return (
    <div ref={containerRef} className="max-w-2xl">
      <div
        ref={lineRef}
        className="mb-4 h-px w-16 bg-accent/70 will-change-transform"
      />
      <p
        ref={eyebrowRef}
        className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-accent"
      >
        {eyebrow}
      </p>
      <h2
        aria-label={title}
        className="mt-3 flex flex-wrap gap-x-[0.26em] gap-y-1 text-3xl font-medium leading-[1.08] tracking-[-0.035em] text-ink md:text-[42px]"
      >
        {words.map((w, idx) => (
          <span key={idx} className="inline-block overflow-hidden py-0.5">
            <span
              ref={(el) => (wordRefs.current[idx] = el)}
              className="inline-block will-change-transform"
            >
              {w}
            </span>
          </span>
        ))}
      </h2>
      {children && (
        <p
          ref={subRef}
          className="mt-4 text-[17px] leading-relaxed text-muted will-change-transform"
        >
          {children}
        </p>
      )}
    </div>
  );
}

function FaqItem({ q, a, index }) {
  const [isOpen, setIsOpen] = useState(false);
  const rowRef = useRef(null);
  const borderRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rowRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          delay: index * 0.06,
          ease: "power3.out",
          scrollTrigger: {
            trigger: rowRef.current,
            start: "top 90%",
          },
        }
      );
      gsap.fromTo(
        borderRef.current,
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1,
          duration: 0.85,
          delay: index * 0.06,
          ease: "expo.out",
          scrollTrigger: {
            trigger: rowRef.current,
            start: "top 90%",
          },
        }
      );
    }, rowRef);

    return () => ctx.revert();
  }, [index]);

  return (
    <div ref={rowRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left text-[16px] font-medium text-ink transition-colors hover:text-ink-soft"
      >
        <span className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-faint">
            0{index + 1}
          </span>
          <span>{q}</span>
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="shrink-0 text-muted"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              d="M8 2v12M2 8h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-6 pl-7 text-[15px] leading-relaxed text-muted">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={borderRef}
        className="h-px w-full bg-line will-change-transform"
      />
    </div>
  );
}

const CTA_WORDS = [
  "Understand",
  "any",
  "codebase.",
  "Instantly.",
];

export default function LandingPage() {
  const [introDone, setIntroDone] = useState(false);

  const pageRef = useRef(null);
  const heroEyebrowRef = useRef(null);
  const heroWordRefs = useRef([]);
  const heroUnderlineRefs = useRef([]);
  const heroSublineRefs = useRef([]);
  const heroCtaRef = useRef(null);
  const heroNoteRef = useRef(null);
  const heroStatsRefs = useRef([]);
  const previewWrapRef = useRef(null);
  const floatBadgeLeftRef = useRef(null);
  const floatBadgeRightRef = useRef(null);
  const langItemRefs = useRef([]);
  const statementSectionRef = useRef(null);
  const statementWordRefs = useRef([]);
  const stepsSectionRef = useRef(null);
  const stepCardRefs = useRef([]);
  const stepCountRef = useRef(null);
  const stepBarRef = useRef(null);
  const whyCardRefs = useRef([]);
  const whyBorderRefs = useRef([]);
  const ctaCardRef = useRef(null);
  const ctaWordRefs = useRef([]);

  // 1. Hero Entrance GSAP Choreography (fires right as the 5-column curtain lifts)
  useEffect(() => {
    if (!introDone) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Decode Hero Eyebrow badge
      if (heroEyebrowRef.current) {
        const target = "WHAT WE DO — STRUCTURED GRAPH + GRAPH-AWARE AI";
        const state = { p: 0 };
        tl.fromTo(
          heroEyebrowRef.current,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
          0
        );
        tl.to(
          state,
          {
            p: 1,
            duration: 0.75,
            ease: "power2.out",
            onUpdate: () => {
              if (!heroEyebrowRef.current) return;
              const count = Math.floor(state.p * target.length);
              let out = "";
              for (let i = 0; i < target.length; i++) {
                if (
                  target[i] === " " ||
                  target[i] === "—" ||
                  target[i] === "+" ||
                  target[i] === "-"
                ) {
                  out += target[i];
                } else if (i <= count) {
                  out += target[i];
                } else {
                  out += GLYPHS[(i + Math.floor(state.p * 28)) % GLYPHS.length];
                }
              }
              heroEyebrowRef.current.textContent = out;
            },
          },
          0.05
        );
      }

      // Split-Word Masked Hero Headline
      const words = heroWordRefs.current.filter(Boolean);
      if (words.length) {
        tl.fromTo(
          words,
          {
            yPercent: 120,
            x: (i) => (i % 2 === 0 ? -12 : 12),
            rotateZ: (i) => (i % 2 === 0 ? 4 : -3),
            skewX: -8,
            opacity: 0,
          },
          {
            yPercent: 0,
            x: 0,
            rotateZ: 0,
            skewX: 0,
            opacity: 1,
            duration: 1.0,
            stagger: 0.065,
            ease: "expo.out",
          },
          0.08
        );
      }

      // Draw Terracotta Underlines beneath key hero words
      const underlines = heroUnderlineRefs.current.filter(Boolean);
      if (underlines.length) {
        tl.fromTo(
          underlines,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.85,
            stagger: 0.08,
            ease: "expo.out",
          },
          0.42
        );
      }

      // Opposite-direction Hero Subline lines
      const sublines = heroSublineRefs.current.filter(Boolean);
      if (sublines.length) {
        tl.fromTo(
          sublines,
          {
            yPercent: 110,
            x: (i) => (i % 2 === 0 ? 18 : -18),
            opacity: 0,
          },
          {
            yPercent: 0,
            x: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.07,
            ease: "expo.out",
          },
          0.2
        );
      }

      // Hero CTA Buttons + No credit card note
      if (heroCtaRef.current) {
        tl.fromTo(
          heroCtaRef.current,
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "expo.out" },
          0.36
        );
      }

      if (heroNoteRef.current) {
        tl.fromTo(
          heroNoteRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, ease: "power3.out" },
          0.46
        );
      }

      // Slot-rolling Hero Telemetry Metrics
      const stats = heroStatsRefs.current.filter(Boolean);
      if (stats.length) {
        tl.fromTo(
          stats,
          { yPercent: 115, skewY: 5, opacity: 0 },
          {
            yPercent: 0,
            skewY: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.07,
            ease: "back.out(1.5)",
          },
          0.5
        );
      }

      // ProductPreview Workbench Entrance + Floating Telemetry Badges
      if (previewWrapRef.current) {
        tl.fromTo(
          previewWrapRef.current,
          { y: 44, scale: 0.965, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 1.15,
            ease: "expo.out",
          },
          0.26
        );
      }

      if (floatBadgeLeftRef.current && floatBadgeRightRef.current) {
        tl.fromTo(
          [floatBadgeLeftRef.current, floatBadgeRightRef.current],
          { y: 20, scale: 0.9, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: "back.out(1.6)",
          },
          0.65
        );

        gsap.to(floatBadgeLeftRef.current, {
          y: -7,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1.4,
        });
        gsap.to(floatBadgeRightRef.current, {
          y: 7,
          duration: 2.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 1.4,
        });
      }
    }, pageRef);

    return () => ctx.revert();
  }, [introDone]);

  // 2. Full-Page ScrollTrigger & GSAP Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Languages Strip Staggered Pop
      const langs = langItemRefs.current.filter(Boolean);
      if (langs.length) {
        gsap.fromTo(
          langs,
          { y: 24, opacity: 0, rotateX: 15 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.7,
            stagger: 0.06,
            ease: "expo.out",
            scrollTrigger: {
              trigger: langs[0],
              start: "top 88%",
            },
          }
        );
      }

      // Statement Quote: Word-by-Word Scroll-Scrubbed Reveal + Kinetic Rise
      const sWords = statementWordRefs.current.filter(Boolean);
      if (sWords.length && statementSectionRef.current) {
        gsap.fromTo(
          sWords,
          {
            opacity: 0.16,
            y: 12,
          },
          {
            opacity: 1,
            y: 0,
            stagger: 0.04,
            ease: "power2.out",
            scrollTrigger: {
              trigger: statementSectionRef.current,
              start: "top 80%",
              end: "bottom 55%",
              scrub: 0.6,
            },
          }
        );
      }

      // How It Works: 4-Step Staggered Cards + Live Tree-Sitter Counter
      const sCards = stepCardRefs.current.filter(Boolean);
      if (sCards.length && stepsSectionRef.current) {
        gsap.fromTo(
          sCards,
          { y: 48, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.85,
            stagger: 0.12,
            ease: "expo.out",
            scrollTrigger: {
              trigger: stepsSectionRef.current,
              start: "top 78%",
            },
          }
        );

        const counterObj = { val: 0 };
        gsap.to(counterObj, {
          val: 3410,
          duration: 1.8,
          ease: "expo.out",
          scrollTrigger: {
            trigger: stepsSectionRef.current,
            start: "top 75%",
          },
          onUpdate: () => {
            if (stepCountRef.current) {
              stepCountRef.current.textContent = `${Math.floor(
                counterObj.val
              ).toLocaleString()} symbols`;
            }
          },
        });

        if (stepBarRef.current) {
          gsap.fromTo(
            stepBarRef.current,
            { scaleX: 0, transformOrigin: "left center" },
            {
              scaleX: 1,
              duration: 1.6,
              ease: "expo.out",
              scrollTrigger: {
                trigger: stepsSectionRef.current,
                start: "top 75%",
              },
            }
          );
        }
      }

      // Why It's Different (I, II, III): Top Border Draw + Staggered Column Entrance
      const wCards = whyCardRefs.current.filter(Boolean);
      const wBorders = whyBorderRefs.current.filter(Boolean);
      if (wCards.length) {
        gsap.fromTo(
          wBorders,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.95,
            stagger: 0.14,
            ease: "expo.out",
            scrollTrigger: {
              trigger: wCards[0],
              start: "top 84%",
            },
          }
        );
        gsap.fromTo(
          wCards,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.14,
            ease: "power3.out",
            scrollTrigger: {
              trigger: wCards[0],
              start: "top 84%",
            },
          }
        );
      }

      // Bottom CTA Banner: Scale Unclip + Split-Word Headline Reveal
      if (ctaCardRef.current) {
        gsap.fromTo(
          ctaCardRef.current,
          { y: 36, scale: 0.96, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.95,
            ease: "expo.out",
            scrollTrigger: {
              trigger: ctaCardRef.current,
              start: "top 85%",
            },
          }
        );

        const cWords = ctaWordRefs.current.filter(Boolean);
        if (cWords.length) {
          gsap.fromTo(
            cWords,
            { yPercent: 118, skewX: -6, opacity: 0 },
            {
              yPercent: 0,
              skewX: 0,
              opacity: 1,
              duration: 0.85,
              stagger: 0.04,
              ease: "expo.out",
              scrollTrigger: {
                trigger: ctaCardRef.current,
                start: "top 82%",
              },
            }
          );
        }
      }
    }, pageRef);

    return () => ctx.revert();
  }, []);

  // Interactive mouse parallax on the Hero ProductPreview workbench
  const handlePreviewMouseMove = (e) => {
    if (!previewWrapRef.current) return;
    const rect = previewWrapRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(floatBadgeLeftRef.current, {
      x: relX * -22,
      duration: 0.45,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(floatBadgeRightRef.current, {
      x: relX * 22,
      duration: 0.45,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(previewWrapRef.current, {
      rotateY: relX * 2.2,
      rotateX: relY * -2.2,
      transformPerspective: 1200,
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handlePreviewMouseLeave = () => {
    gsap.to([floatBadgeLeftRef.current, floatBadgeRightRef.current], {
      x: 0,
      duration: 0.6,
      ease: "expo.out",
      overwrite: "auto",
    });
    gsap.to(previewWrapRef.current, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.7,
      ease: "expo.out",
      overwrite: "auto",
    });
  };

  heroWordRefs.current = [];
  heroUnderlineRefs.current = [];
  heroSublineRefs.current = [];
  heroStatsRefs.current = [];
  statementWordRefs.current = [];
  ctaWordRefs.current = [];

  return (
    <div ref={pageRef} className="flex min-h-screen flex-col bg-paper">
      {/* 5-Second GSAP Kinetic Story Intro + Multi-Column Curtain Reveal */}
      <LoadingScreen onComplete={() => setIntroDone(true)} />

      <Navbar />

      <main className="flex-1 overflow-x-hidden">
        {/* WHAT WE DO — Hero Section */}
        <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 md:pb-16 md:pt-20">
          {/* Live Decoded WHAT WE DO Eyebrow Pill */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 py-1.5 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <span
              ref={heroEyebrowRef}
              className="font-mono text-[11px] font-medium tracking-[0.08em] text-ink-soft"
            >
              WHAT WE DO — STRUCTURED GRAPH + GRAPH-AWARE AI
            </span>
          </div>

          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-12">
            {/* Left 7 Columns: "Understand any codebase. Instantly." */}
            <div className="md:col-span-7">
              <h1
                aria-label="Understand any codebase. Instantly."
                className="flex flex-wrap gap-x-[0.24em] gap-y-1.5 text-[46px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[60px] lg:text-[72px]"
              >
                {HERO_WORDS.map((wordObj, idx) => (
                  <span
                    key={wordObj.text}
                    className={`relative inline-block overflow-hidden py-1 ${
                      wordObj.text === "Instantly." ? "basis-full sm:basis-auto" : ""
                    }`}
                  >
                    <span
                      ref={(el) => (heroWordRefs.current[idx] = el)}
                      className={`inline-block will-change-transform ${
                        wordObj.text === "Instantly." ? "text-accent" : "text-ink"
                      }`}
                    >
                      {wordObj.text}
                    </span>
                    {wordObj.accent && (
                      <span
                        ref={(el) => heroUnderlineRefs.current.push(el)}
                        className="absolute bottom-1 left-0 h-[3px] w-full bg-accent/85 will-change-transform"
                      />
                    )}
                  </span>
                ))}
              </h1>
            </div>

            {/* Right 5 Columns: Exact Subline + "Get started free" & "Sign in" + Note */}
            <div className="md:col-span-5 md:pb-1">
              <div className="space-y-1">
                {[
                  "We don't treat code as text. We convert it into a",
                  "structured graph of relationships, then use AI to",
                  "generate meaningful explanations.",
                ].map((line, lIdx) => (
                  <div key={lIdx} className="overflow-hidden">
                    <p
                      ref={(el) => (heroSublineRefs.current[lIdx] = el)}
                      className="text-[16.5px] leading-relaxed text-muted will-change-transform"
                    >
                      {line}
                    </p>
                  </div>
                ))}
              </div>

              <div
                ref={heroCtaRef}
                className="mt-7 flex flex-wrap items-center gap-3 will-change-transform"
              >
                <motion.div whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-2.5 text-[15px] font-medium text-paper shadow-sm transition-colors hover:bg-ink-soft"
                  >
                    <span>Get started free</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </motion.div>

                <motion.div whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/login"
                    className="inline-flex items-center rounded-md border border-line-strong bg-surface px-5 py-2.5 text-[15px] font-medium text-ink-soft shadow-sm transition-colors hover:border-ink hover:text-ink"
                  >
                    Sign in
                  </Link>
                </motion.div>
              </div>

              <p
                ref={heroNoteRef}
                className="mt-3 font-mono text-[11.5px] text-faint will-change-transform"
              >
                Free to try — no credit card required
              </p>

              {/* Hero Telemetry Bar */}
              <div className="mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
                {[
                  { val: "Tree-sitter", label: "AST extraction" },
                  { val: "Live Graph", label: "Function tracing" },
                  { val: "Graph AI", label: "Impact analysis" },
                ].map((stat, sIdx) => (
                  <div
                    key={stat.label}
                    className={`overflow-hidden ${sIdx === 0 ? "pr-3" : "px-3"}`}
                  >
                    <div
                      ref={(el) => (heroStatsRefs.current[sIdx] = el)}
                      className="will-change-transform"
                    >
                      <p className="font-mono text-[13px] font-semibold text-ink">
                        {stat.val}
                      </p>
                      <p className="text-[11px] text-faint">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview Section with Floating GSAP Telemetry Callouts & 3D Tilt */}
        <section
          id="product"
          onMouseMove={handlePreviewMouseMove}
          onMouseLeave={handlePreviewMouseLeave}
          className="mx-auto max-w-6xl scroll-mt-24 px-6"
        >
          <div ref={previewWrapRef} className="relative will-change-transform">
            {/* Floating Telemetry Pill #1 (Top-Left) */}
            <div
              ref={floatBadgeLeftRef}
              className="pointer-events-none absolute -top-4 left-6 z-20 hidden items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 font-mono text-[11px] text-ink shadow-md lg:inline-flex will-change-transform"
            >
              <span className="h-2 w-2 rounded-full bg-[#2f9e44]" />
              <span>Tree-sitter AST · 8,920 edges mapped</span>
            </div>

            {/* Floating Telemetry Pill #2 (Bottom-Right) */}
            <div
              ref={floatBadgeRightRef}
              className="pointer-events-none absolute -bottom-4 right-6 z-20 hidden items-center gap-2 rounded-full border border-line-strong bg-ink px-3.5 py-1.5 font-mono text-[11px] text-paper shadow-md lg:inline-flex will-change-transform"
            >
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span>Blast radius: 3 upstream callers</span>
            </div>

            <ProductPreview />
          </div>

          <p className="mt-8 text-center text-[13px] text-faint">
            Interactive relationship graph — click any module or folder to trace its execution paths and blast radius.
          </p>
        </section>

        {/* Languages Strip */}
        <section className="mx-auto max-w-6xl px-6 pt-20">
          <div className="flex flex-col gap-4 border-y border-line py-6 md:flex-row md:items-center md:justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
              Tree-sitter grammars built for your stack
            </p>
            <ul className="flex flex-wrap gap-x-7 gap-y-2">
              {LANGUAGES.map((lang, idx) => (
                <li
                  key={lang.name}
                  ref={(el) => (langItemRefs.current[idx] = el)}
                  className="group flex cursor-default items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-sm font-medium text-ink-soft transition-colors hover:border-line hover:bg-surface hover:text-ink will-change-transform"
                >
                  <span>{lang.name}</span>
                  <span className="font-mono text-[11px] text-accent">
                    {lang.ext}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS — 4-Step Pipeline (Upload, Parse, Graph, Ask) */}
        <section
          id="how-it-works"
          ref={stepsSectionRef}
          className="mt-20 scroll-mt-16 border-y border-line bg-sunken"
        >
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
            <SectionHeading
              eyebrow="HOW IT WORKS"
              title="From repository to structured relationship graph."
            >
              Four automated stages that turn raw files into a queryable
              architectural map.
            </SectionHeading>

            <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {/* 01: Upload, not configure. */}
              <li
                ref={(el) => (stepCardRefs.current[0] = el)}
                className="flex flex-col bg-paper p-6 transition-shadow hover:shadow-md md:p-7 will-change-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-semibold text-accent">
                    01
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
                    ZERO SETUP
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-medium tracking-tight text-ink">
                  Upload, not configure.
                </h3>
                <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">
                  Paste a GitHub link or drag in a repo, zero setup.
                </p>
                <div className="mt-7 rounded-md border border-line bg-surface p-2.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-ink">
                    <span className="truncate">github.com/acme/api</span>
                    <span className="rounded bg-[#e9f5ec] px-1.5 py-0.5 text-[10px] font-medium text-[#1e7a34]">
                      Ready
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-faint">
                    Or drag & drop folder · 0 config files
                  </p>
                </div>
              </li>

              {/* 02: Parse, not read. */}
              <li
                ref={(el) => (stepCardRefs.current[1] = el)}
                className="flex flex-col bg-paper p-6 transition-shadow hover:shadow-md md:p-7 will-change-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-semibold text-accent">
                    02
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
                    TREE-SITTER
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-medium tracking-tight text-ink">
                  Parse, not read.
                </h3>
                <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">
                  Tree-sitter extracts every function, class, import
                  automatically.
                </p>
                <div className="mt-7 rounded-md border border-line bg-surface p-2.5 text-[11px]">
                  <div className="flex justify-between font-mono">
                    <span className="text-ink-soft">Tree-sitter AST</span>
                    <span
                      ref={stepCountRef}
                      className="tabular-nums font-medium text-ink"
                    >
                      3,410 symbols
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
                    <div
                      ref={stepBarRef}
                      className="h-full w-full rounded-full bg-ink will-change-transform"
                    />
                  </div>
                  <div className="mt-2 flex gap-2 font-mono text-[10px] text-faint">
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-ink-soft">
                      fn
                    </span>
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-ink-soft">
                      class
                    </span>
                    <span className="rounded bg-sunken px-1.5 py-0.5 text-ink-soft">
                      import
                    </span>
                  </div>
                </div>
              </li>

              {/* 03: Graph, not list. */}
              <li
                ref={(el) => (stepCardRefs.current[2] = el)}
                className="flex flex-col bg-paper p-6 transition-shadow hover:shadow-md md:p-7 will-change-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-semibold text-accent">
                    03
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
                    TOPOLOGY
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-medium tracking-tight text-ink">
                  Graph, not list.
                </h3>
                <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">
                  Relationships are mapped into a live dependency graph.
                </p>
                <div className="mt-7 rounded-md border border-line bg-surface p-2.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between text-ink">
                    <span className="rounded border border-line px-1.5 py-0.5">
                      routes
                    </span>
                    <span className="text-accent">⎯⎯▸</span>
                    <span className="rounded border border-ink bg-ink px-1.5 py-0.5 text-paper">
                      services
                    </span>
                    <span className="text-accent">⎯⎯▸</span>
                    <span className="rounded border border-line px-1.5 py-0.5">
                      db
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-faint">
                    8,920 live directed edges mapped
                  </p>
                </div>
              </li>

              {/* 04: Ask, not search. */}
              <li
                ref={(el) => (stepCardRefs.current[3] = el)}
                className="flex flex-col bg-paper p-6 transition-shadow hover:shadow-md md:p-7 will-change-transform"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] font-semibold text-accent">
                    04
                  </span>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
                    GRAPH-AWARE AI
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-medium tracking-tight text-ink">
                  Ask, not search.
                </h3>
                <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">
                  Natural language queries answered with graph-aware AI.
                </p>
                <div className="mt-7 rounded-md border border-line bg-surface p-2.5 font-mono text-[11px]">
                  <p className="truncate text-ink">
                    “Where are failed charges retried?”
                  </p>
                  <p className="mt-1.5 text-[10px] text-accent">
                    → jobs/retry-charges.ts:18
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* WHY IT'S DIFFERENT — Roman Numeral Pillars (I, II, III) */}
        <section
          id="why-different"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 md:py-32"
        >
          <SectionHeading
            eyebrow="WHY IT'S DIFFERENT"
            title="Built on structure and execution paths, not text search."
          />

          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {WHY_DIFFERENT.map((item, i) => (
              <div
                key={item.title}
                ref={(el) => (whyCardRefs.current[i] = el)}
                className="relative flex flex-col justify-between pt-7 will-change-transform"
              >
                <div
                  ref={(el) => (whyBorderRefs.current[i] = el)}
                  className="absolute left-0 top-0 h-[2px] w-full bg-ink will-change-transform"
                />

                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-line-strong bg-surface px-2 font-mono text-[13px] font-semibold text-accent">
                      {item.roman}
                    </span>
                    <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="mt-5 text-[22px] font-medium tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-[15.5px] leading-relaxed text-muted">
                    {item.body}
                  </p>
                </div>

                {item.preview}
              </div>
            ))}
          </div>
        </section>

        {/* Scroll-Scrubbed Word-by-Word Philosophy Statement */}
        <section
          ref={statementSectionRef}
          className="border-t border-line bg-sunken/50 py-24 md:py-28"
        >
          <div className="mx-auto max-w-6xl px-6">
            <p className="mb-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-accent">
              // OUR PHILOSOPHY
            </p>
            <p
              aria-label={STATEMENT_WORDS.map((w) => w.text).join(" ")}
              className="flex max-w-4xl flex-wrap gap-x-[0.28em] gap-y-2 text-[28px] font-medium leading-[1.18] tracking-[-0.03em] md:text-[42px] md:leading-[1.14]"
            >
              {STATEMENT_WORDS.map((item, idx) => (
                <span
                  key={idx}
                  ref={(el) => (statementWordRefs.current[idx] = el)}
                  className={`inline-block will-change-transform ${
                    item.highlight
                      ? "underline decoration-accent/80 decoration-2 underline-offset-6 text-ink"
                      : item.muted
                      ? "text-muted"
                      : "text-ink"
                  }`}
                >
                  {item.text}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* Interactive Feature Showcase */}
        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 md:py-32"
        >
          <SectionHeading
            eyebrow="INTERACTIVE WORKBENCH"
            title="Explore every layer of your codebase."
          >
            Switch between Dependency Graph, Code Health, Impact Analysis, and
            Graph-Aware AI Q&A.
          </SectionHeading>
          <div className="mt-12 md:mt-16">
            <FeatureTabs />
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-24 md:pb-32"
        >
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <SectionHeading eyebrow="FAQ" title="Questions, answered." />
            </div>
            <div className="border-t border-line md:col-span-8">
              {FAQS.map((f, idx) => (
                <FaqItem key={f.q} q={f.q} a={f.a} index={idx} />
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div
            ref={ctaCardRef}
            className="relative overflow-hidden rounded-2xl bg-ink px-6 py-12 sm:px-10 md:px-14 md:py-20 will-change-transform"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#c8502a]/10 blur-3xl" />

            <div className="relative z-10 grid gap-10 md:grid-cols-12 md:items-end">
              <div className="md:col-span-7">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
                  // WHAT WE DO
                </p>
                <h2
                  aria-label={CTA_WORDS.join(" ")}
                  className="flex flex-wrap gap-x-[0.26em] gap-y-1 text-[34px] font-medium leading-[1.05] tracking-[-0.04em] text-paper md:text-5xl"
                >
                  {CTA_WORDS.map((w, idx) => (
                    <span
                      key={idx}
                      className="inline-block overflow-hidden py-0.5"
                    >
                      <span
                        ref={(el) => (ctaWordRefs.current[idx] = el)}
                        className="inline-block will-change-transform"
                      >
                        {w}
                      </span>
                    </span>
                  ))}
                </h2>
                <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#9d9a91]">
                  We convert your repository into a structured graph of
                  relationships, then use AI to generate meaningful explanations.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 md:col-span-5 md:items-end">
                <div className="flex flex-wrap items-center gap-3">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/signup"
                      className="inline-flex items-center gap-2 rounded-md bg-paper px-6 py-3 text-[15px] font-medium text-ink shadow-sm transition-colors hover:bg-white"
                    >
                      <span>Get started free</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/login"
                      className="inline-flex items-center rounded-md border border-[#3a3833] px-6 py-3 text-[15px] font-medium text-paper transition-colors hover:border-[#6c6960]"
                    >
                      Sign in
                    </Link>
                  </motion.div>
                </div>
                <p className="font-mono text-[11.5px] text-[#9d9a91]">
                  Free to try — no credit card required
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
