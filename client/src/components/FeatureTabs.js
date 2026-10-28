"use client";

import { Fragment, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LogoMark } from "./Logo";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const FEATURES = [
  {
    id: "deps",
    title: "Dependency Graph",
    body: "Relationships are mapped into a live dependency graph. Instantly locate circular dependencies and architectural bottlenecks.",
  },
  {
    id: "health",
    title: "Function Tracing & Bottlenecks",
    body: "Follow execution paths visually through your entire codebase and rank files by Tree-sitter complexity without losing cognitive focus.",
  },
  {
    id: "impact",
    title: "Impact Analysis",
    body: "See the blast radius of any change before making it — tracing every upstream caller and downstream dependent across the repo.",
  },
  {
    id: "ask",
    title: "Ask, not search",
    body: "Natural language queries answered with graph-aware AI that points to exact functions, files, and line numbers.",
  },
];

function Arrow() {
  return (
    <svg viewBox="0 0 16 8" className="h-2 w-4 shrink-0 text-faint" aria-hidden="true">
      <path d="M0 4h14M11 1l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function DepsVisual() {
  const cycles = [
    ["services/orders.ts", "services/inventory.ts", "services/orders.ts"],
    ["lib/auth.ts", "lib/session.ts", "lib/users.ts", "lib/auth.ts"],
  ];
  const hubs = [
    { file: "lib/db.ts", count: 14 },
    { file: "lib/logger.ts", count: 11 },
    { file: "middleware/session.ts", count: 7 },
    { file: "lib/config.ts", count: 5 },
  ];
  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Circular dependencies</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdecea] px-2 py-0.5 text-xs font-medium text-[#b42318]">
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-[#b42318]"
            />
            2 found
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {cycles.map((cycle) => (
            <div
              key={cycle.join()}
              className="flex flex-wrap items-center gap-1.5 rounded-md border border-line p-2.5 font-mono text-[12px]"
            >
              {cycle.map((file, i) => (
                <Fragment key={`${file}-${i}`}>
                  <span
                    className={`rounded px-1.5 py-0.5 ${
                      i === cycle.length - 1
                        ? "bg-accent-soft text-accent"
                        : "bg-sunken text-ink-soft"
                    }`}
                  >
                    {file}
                  </span>
                  {i < cycle.length - 1 && <Arrow />}
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink">Most depended on</p>
        <ul className="mt-3 space-y-2.5">
          {hubs.map((h, idx) => (
            <li key={h.file} className="grid grid-cols-[150px_1fr_28px] items-center gap-3 text-[12.5px]">
              <span className="truncate font-mono text-ink-soft">{h.file}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-sunken">
                <motion.span
                  className="block h-1.5 rounded-full bg-ink"
                  initial={{ width: 0 }}
                  animate={{ width: `${(h.count / 14) * 100}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.08, ease: "easeOut" }}
                />
              </span>
              <span className="text-right tabular-nums text-muted">{h.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HealthVisual() {
  const rows = [
    { file: "services/payments.ts", complexity: 46, changes: 38, risk: "High" },
    { file: "routes/checkout.ts", complexity: 31, changes: 27, risk: "High" },
    { file: "services/orders.ts", complexity: 28, changes: 12, risk: "Medium" },
    { file: "services/inventory.ts", complexity: 22, changes: 9, risk: "Medium" },
    { file: "lib/db.ts", complexity: 8, changes: 2, risk: "Low" },
  ];
  const riskStyle = {
    High: "bg-[#fdecea] text-[#b42318]",
    Medium: "bg-[#fdf3e1] text-[#9a6200]",
    Low: "bg-[#e9f5ec] text-[#1e7a34]",
  };
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink">Where to look first</p>
        <p className="text-xs text-faint">Last 90 days</p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-[11px] text-faint">
              <th className="pb-2 font-normal">File</th>
              <th className="pb-2 font-normal">Complexity</th>
              <th className="pb-2 text-right font-normal">Changes</th>
              <th className="pb-2 text-right font-normal">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.file}>
                <td className="py-3 pr-4 font-mono text-ink-soft">{r.file}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-sunken">
                      <motion.span
                        className="block h-1.5 rounded-full bg-ink"
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.complexity / 50) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                      />
                    </span>
                    <span className="tabular-nums text-muted">{r.complexity}</span>
                  </div>
                </td>
                <td className="py-3 text-right tabular-nums text-muted">{r.changes}</td>
                <td className="py-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${riskStyle[r.risk]}`}>
                    {r.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImpactVisual() {
  const tree = [
    { file: "routes/checkout.ts", depth: 1, via: "direct" },
    { file: "routes/subscriptions.ts", depth: 1, via: "direct" },
    { file: "jobs/retry-charges.ts", depth: 1, via: "direct" },
    { file: "services/orders.ts", depth: 1, via: "direct" },
    { file: "routes/orders.ts", depth: 2, via: "via orders.ts" },
    { file: "jobs/nightly-report.ts", depth: 2, via: "via orders.ts" },
  ];
  return (
    <div>
      <p className="text-[13px] text-muted">If you change</p>
      <div className="mt-1 flex items-center gap-2 font-mono text-[13px] text-ink">
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">chargeCustomer()</span>
        <span className="text-faint"> in </span>
        <span>services/payments.ts</span>
      </div>

      <div className="mt-5 flex items-center justify-between border-b border-line pb-2">
        <p className="text-sm font-medium text-ink">6 files affected</p>
        <p className="text-xs text-faint">4 direct · 2 indirect</p>
      </div>

      <ul className="mt-2">
        {tree.map((t, idx) => (
          <motion.li
            key={t.file}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="flex items-center justify-between py-2 text-[12.5px]"
            style={{ paddingLeft: t.depth === 2 ? 28 : 0 }}
          >
            <span className="flex items-center gap-2 font-mono text-ink-soft">
              <span className="text-line-strong" aria-hidden="true">
                {t.depth === 2 ? "└" : "├"}
              </span>
              {t.file}
            </span>
            <span className={t.via === "direct" ? "text-muted" : "text-faint"}>{t.via}</span>
          </motion.li>
        ))}
      </ul>

      <p className="mt-4 rounded-md bg-sunken px-3 py-2.5 text-[12.5px] text-muted">
        4 test files cover these paths. <span className="text-ink-soft font-medium">1 path has no tests.</span>
      </p>
    </div>
  );
}

function AskVisual() {
  const code = [
    { n: 18, text: "export async function retryFailedCharges() {" },
    { n: 19, text: "  const pending = await db.payment.findMany({" },
    { n: 20, text: "    where: { status: 'requires_retry', attempts: { lt: 3 } }," },
    { n: 21, text: "  });" },
    { n: 22, text: "  for (const p of pending) {", hl: true },
    { n: 23, text: "    await chargeCustomer(p.customerId, p.amount);", hl: true },
    { n: 24, text: "  }" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-medium text-ink-soft">
          R
        </span>
        <p className="pt-0.5 text-[14px] text-ink font-medium">Where do we retry failed payments?</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-start gap-3"
      >
        <LogoMark className="h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="pt-0.5 text-[14px] leading-relaxed text-ink-soft">
            In <code className="font-mono text-[12.5px] text-ink bg-sunken px-1 rounded">jobs/retry-charges.ts</code>. It runs every 15
            minutes, picks up payments marked <code className="font-mono text-[12.5px] text-ink bg-sunken px-1 rounded">requires_retry</code>{" "}
            and calls <code className="font-mono text-[12.5px] text-ink bg-sunken px-1 rounded">chargeCustomer()</code> again — at most three
            times.
          </p>

          <div className="mt-3 overflow-hidden rounded-md border border-line">
            <div className="border-b border-line bg-paper px-3 py-1.5 font-mono text-[11px] text-faint">
              jobs/retry-charges.ts · lines 18–24
            </div>
            <pre className="overflow-x-auto py-1.5 font-mono text-[12px] leading-[1.7]">
              {code.map((line) => (
                <div key={line.n} className={`flex px-3 ${line.hl ? "bg-accent-soft" : ""}`}>
                  <span className="w-7 shrink-0 select-none text-line-strong">{line.n}</span>
                  <span className={line.hl ? "text-ink font-medium" : "text-ink-soft"}>{line.text}</span>
                </div>
              ))}
            </pre>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["services/payments.ts:142", "lib/queue.ts:31"].map((s) => (
              <span key={s} className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

const VISUALS = {
  deps: DepsVisual,
  health: HealthVisual,
  impact: ImpactVisual,
  ask: AskVisual,
};

export default function FeatureTabs() {
  const [activeId, setActiveId] = useState("deps");
  const Visual = VISUALS[activeId];

  const rootRef = useRef(null);
  const tabItemRefs = useRef([]);
  const visualCardRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const items = tabItemRefs.current.filter(Boolean);
      if (items.length) {
        gsap.fromTo(
          items,
          { x: -24, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.09,
            ease: "expo.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 82%",
            },
          }
        );
      }
      if (visualCardRef.current) {
        gsap.fromTo(
          visualCardRef.current,
          { y: 32, scale: 0.97, opacity: 0 },
          {
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.9,
            ease: "expo.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 82%",
            },
          }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <ul className="divide-y divide-line border-y border-line lg:col-span-5" role="tablist">
        {FEATURES.map((f, idx) => {
          const active = f.id === activeId;
          return (
            <li
              key={f.id}
              ref={(el) => (tabItemRefs.current[idx] = el)}
              className="will-change-transform"
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveId(f.id)}
                className="group w-full py-5 text-left cursor-pointer transition-colors"
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`flex items-center gap-3 text-[17px] font-medium tracking-tight transition-colors ${
                      active ? "text-ink" : "text-faint group-hover:text-ink-soft"
                    }`}
                  >
                    <span className="font-mono text-[11px] text-accent">
                      0{idx + 1}
                    </span>
                    <span>{f.title}</span>
                  </span>
                  <motion.span
                    animate={{ scale: active ? 1 : 0.6, opacity: active ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-2 w-2 rounded-full bg-accent"
                  />
                </span>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pl-7 pt-2 text-[15px] leading-relaxed text-muted">
                        {f.body}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={visualCardRef} className="lg:col-span-7 will-change-transform">
        <div className="rounded-xl border border-line bg-sunken p-3 sm:p-6">
          <div className="min-h-[380px] rounded-lg border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(26,25,21,0.04)] sm:p-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Visual />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
