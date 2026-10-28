"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Node geometry for the dependency graph (SVG user units).
const W = 150;
const H = 44;
const COL_X = [16, 300, 584];

const MODULES = [
  { id: "checkout", folder: "routes", name: "checkout.ts", col: 0, y: 56, lines: 184, complexity: "Moderate",
    summary: "Handles POST /checkout. Reserves stock, creates the order and takes payment in a single request." },
  { id: "orders-route", folder: "routes", name: "orders.ts", col: 0, y: 144, lines: 126, complexity: "Low",
    summary: "REST endpoints for listing and cancelling orders. Sends a confirmation email when an order ships." },
  { id: "auth", folder: "routes", name: "auth.ts", col: 0, y: 232, lines: 158, complexity: "Moderate",
    summary: "Sign-in, sign-out and token refresh. Issues session cookies through the session middleware." },
  { id: "payments", folder: "services", name: "payments.ts", col: 1, y: 12, lines: 412, complexity: "High",
    summary: "Wraps the Stripe SDK. Creates payment intents, captures charges and issues refunds, retrying on network errors." },
  { id: "inventory", folder: "services", name: "inventory.ts", col: 1, y: 78, lines: 231, complexity: "Moderate",
    summary: "Tracks stock per SKU. Reserves items during checkout and releases them if the payment fails." },
  { id: "orders", folder: "services", name: "orders.ts", col: 1, y: 144, lines: 298, complexity: "Moderate",
    summary: "The order lifecycle — create, fulfil, cancel. Every write goes through a single database transaction." },
  { id: "email", folder: "services", name: "email.ts", col: 1, y: 210, lines: 88, complexity: "Low",
    summary: "Renders transactional email templates and sends them through Postmark." },
  { id: "session", folder: "middleware", name: "session.ts", col: 1, y: 276, lines: 97, complexity: "Low",
    summary: "Reads the session cookie, loads the user and attaches it to the request. Rejects expired sessions." },
  { id: "db", folder: "lib", name: "db.ts", col: 2, y: 100, lines: 64, complexity: "Low",
    summary: "Creates the shared Prisma client and exports typed helpers for running transactions." },
  { id: "logger", folder: "lib", name: "logger.ts", col: 2, y: 210, lines: 41, complexity: "Low",
    summary: "Structured JSON logger with request IDs. Used across services for errors and audit events." },
];

const EDGES = [
  ["checkout", "payments"], ["checkout", "inventory"], ["checkout", "orders"], ["checkout", "session"],
  ["orders-route", "orders"], ["orders-route", "email"], ["orders-route", "session"],
  ["auth", "session"],
  ["payments", "db"], ["payments", "logger"],
  ["inventory", "db"],
  ["orders", "db"],
  ["email", "logger"],
  ["session", "db"],
];

const TREE = [
  { folder: "routes", ids: ["checkout", "orders-route", "auth"] },
  { folder: "services", ids: ["payments", "inventory", "orders", "email"] },
  { folder: "middleware", ids: ["session"] },
  { folder: "lib", ids: ["db", "logger"] },
];

const COMPLEXITY_COLOR = {
  Low: "#2f9e44",
  Moderate: "#e8a317",
  High: "#d6453d",
};

const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true">
      <path d="M1.75 3.5h4l1.5 1.5h7v7.5h-12.5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true">
      <path d="M3.5 1.75h6l3 3v9.5h-9z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductPreview() {
  const [selectedId, setSelectedId] = useState("payments");
  const selected = byId[selectedId];

  const imports = EDGES.filter(([from]) => from === selectedId).map(([, to]) => to);
  const usedBy = EDGES.filter(([, to]) => to === selectedId).map(([from]) => from);
  const related = new Set([selectedId, ...imports, ...usedBy]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgba(26,25,21,0.04),0_24px_48px_-24px_rgba(26,25,21,0.18)]"
    >
      {/* Window bar */}
      <div className="flex h-11 items-center justify-between border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="mr-2 hidden gap-1.5 sm:flex" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          </span>
          <span className="text-muted">acme</span>
          <span className="text-line-strong">/</span>
          <span className="truncate font-medium text-ink">storefront-api</span>
          <span className="ml-1 rounded border border-line px-1.5 py-px font-mono text-[11px] text-muted">
            main
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:inline-flex">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="h-1.5 w-1.5 rounded-full bg-[#2f9e44]"
            />
            Graph interactive
          </span>
          <span className="hidden text-[12px] text-faint sm:block">
            1,284 files · indexed 2 min ago
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_300px]">
        {/* File tree */}
        <aside className="hidden border-r border-line bg-paper/60 py-3 md:block">
          <p className="px-4 pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
            Files
          </p>
          <div className="flex items-center gap-1.5 px-4 py-1 text-[13px] text-ink-soft">
            <FolderIcon />
            <span>src</span>
          </div>
          {TREE.map((group) => (
            <div key={group.folder}>
              <div className="flex items-center gap-1.5 py-1 pl-7 pr-4 text-[13px] text-ink-soft">
                <FolderIcon />
                <span>{group.folder}</span>
              </div>
              {group.ids.map((id) => {
                const m = byId[id];
                const isSelected = id === selectedId;
                const isRelated = related.has(id) && !isSelected;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={`group relative flex w-full items-center gap-1.5 py-1 pl-10 pr-4 text-left text-[13px] transition-colors ${
                      isSelected
                        ? "font-medium text-ink bg-sunken"
                        : "text-muted hover:bg-sunken/60 hover:text-ink"
                    }`}
                  >
                    <FileIcon />
                    <span className="truncate">{m.name}</span>
                    {isRelated && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="mt-1 flex items-center gap-1.5 px-4 py-1 text-[13px] text-faint">
            <FileIcon />
            <span>package.json</span>
          </div>
          <div className="flex items-center gap-1.5 px-4 py-1 text-[13px] text-faint">
            <FileIcon />
            <span>README.md</span>
          </div>
        </aside>

        {/* Graph Canvas */}
        <div className="flex min-w-0 flex-col">
          <div className="flex h-10 items-center justify-between gap-4 border-b border-line px-4 text-[12px] text-muted">
            <div className="flex items-center gap-2">
              <span>Routes</span>
              <span className="text-line-strong">→</span>
              <span>Services</span>
              <span className="text-line-strong">→</span>
              <span>Lib</span>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              {Object.entries(COMPLEXITY_COLOR).map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-1 items-center overflow-x-auto px-2 py-4">
            <svg
              viewBox="0 0 750 332"
              className="block h-auto w-full min-w-[600px] select-none"
              role="group"
              aria-label="Module dependency graph"
            >
              <defs>
                <pattern id="pp-dots" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.9" fill="#e7e5e0" />
                </pattern>
                <marker id="pp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 1 9 5 0 9z" fill="#d5d2ca" />
                </marker>
                <marker id="pp-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                  <path d="M0 1 9 5 0 9z" fill="#c8502a" />
                </marker>
              </defs>

              <rect width="750" height="332" fill="url(#pp-dots)" />

              {EDGES.map(([from, to]) => {
                const a = byId[from];
                const b = byId[to];
                const sx = COL_X[a.col] + W;
                const sy = a.y + H / 2;
                const tx = COL_X[b.col] - 2;
                const ty = b.y + H / 2;
                const dx = (tx - sx) / 2;
                const active = from === selectedId || to === selectedId;
                return (
                  <g key={`${from}-${to}`}>
                    <path
                      d={`M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx} ${ty}`}
                      fill="none"
                      markerEnd={active ? "url(#pp-arrow-active)" : "url(#pp-arrow)"}
                      style={{
                        stroke: active ? "#c8502a" : "#d5d2ca",
                        strokeWidth: active ? 1.75 : 1,
                        opacity: active ? 1 : 0.65,
                        transition: "stroke 250ms, opacity 250ms",
                      }}
                    />
                    {active && (
                      <motion.path
                        d={`M${sx} ${sy} C${sx + dx} ${sy} ${tx - dx} ${ty} ${tx} ${ty}`}
                        fill="none"
                        stroke="#c8502a"
                        strokeWidth="2.2"
                        strokeDasharray="6 8"
                        animate={{ strokeDashoffset: [0, -28] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </g>
                );
              })}

              {MODULES.map((m) => {
                const isSelected = m.id === selectedId;
                const isRelated = related.has(m.id);
                return (
                  <motion.g
                    key={m.id}
                    transform={`translate(${COL_X[m.col]} ${m.y})`}
                    onClick={() => setSelectedId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(m.id);
                      }
                    }}
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${m.folder}/${m.name}`}
                    aria-pressed={isSelected}
                    className="cursor-pointer outline-none select-none"
                    style={{ opacity: isRelated ? 1 : 0.42 }}
                  >
                    <rect
                      width={W}
                      height={H}
                      rx="7"
                      style={{
                        fill: isSelected ? "#1a1915" : "#ffffff",
                        stroke: isSelected ? "#1a1915" : isRelated ? "#b9b5ab" : "#e7e5e0",
                        transition: "fill 220ms, stroke 220ms",
                      }}
                    />
                    <text x="12" y="17" fontSize="10" className="font-mono" fill={isSelected ? "#9d9a91" : "#9d9a91"}>
                      {m.folder}/
                    </text>
                    <text x="12" y="33" fontSize="12.5" fontWeight="500" className="font-sans" fill={isSelected ? "#fafaf8" : "#1a1915"}>
                      {m.name}
                    </text>
                    <circle cx={W - 14} cy={H / 2} r="3.2" fill={COMPLEXITY_COLOR[m.complexity]} />
                  </motion.g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Module Inspector with Animated Transitions */}
        <div className="border-t border-line md:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="p-5"
            >
              <p className="font-mono text-[11px] text-faint">src/{selected.folder}/</p>
              <h3 className="mt-1 text-[17px] font-medium tracking-tight text-ink">
                {selected.name}
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                {selected.summary}
              </p>

              <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-md border border-line">
                {[
                  ["Lines", selected.lines],
                  ["Imports", imports.length],
                  ["Used by", usedBy.length],
                ].map(([label, value]) => (
                  <div key={label} className="px-3 py-2.5">
                    <dt className="text-[11px] text-faint">{label}</dt>
                    <dd className="mt-0.5 text-[15px] font-medium tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center justify-between text-[13px]">
                <span className="text-muted">Complexity</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: COMPLEXITY_COLOR[selected.complexity] }}
                  />
                  {selected.complexity}
                </span>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <RelationList
                  title="Imports"
                  ids={imports}
                  empty="No internal imports."
                  onSelect={setSelectedId}
                />
                <RelationList
                  title="Used by"
                  ids={usedBy}
                  empty="Nothing imports this — it's an entry point."
                  onSelect={setSelectedId}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function RelationList({ title, ids, empty, onSelect }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">
        {title}
      </p>
      {ids.length === 0 ? (
        <p className="mt-2 text-[13px] text-faint">{empty}</p>
      ) : (
        <ul className="mt-1.5 -mx-2">
          {ids.map((id) => {
            const m = byId[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className="group flex w-full items-center justify-between rounded px-2 py-1.5 text-left font-mono text-[12.5px] text-ink-soft transition-colors hover:bg-sunken hover:text-ink cursor-pointer"
                >
                  <span className="truncate">
                    <span className="text-faint">{m.folder}/</span>
                    {m.name}
                  </span>
                  <span className="text-faint transition-transform group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
