import Link from "next/link";
import Logo from "./Logo";

export function Field({ id, label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
          {label}
        </label>
        {hint}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] focus:border-ink focus:ring-4 focus:ring-ink/5";

export function SubmitButton({ loading, children, loadingText }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-ink py-2.5 text-[15px] font-medium text-paper transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {loading ? loadingText : children}
    </button>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-md border border-[#f5c2bd] bg-[#fdf1ef] px-3 py-2.5 text-sm text-[#b42318]">
      {message}
    </div>
  );
}

function MiniModuleCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(26,25,21,0.04),0_24px_48px_-28px_rgba(26,25,21,0.2)]">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-muted">
          acme / <span className="font-medium text-ink">storefront-api</span>
        </span>
        <span className="rounded border border-line px-1.5 py-px font-mono text-[11px] text-muted">main</span>
      </div>

      <svg viewBox="0 0 380 150" className="mt-4 block w-full" aria-hidden="true">
        <defs>
          <pattern id="mini-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#e7e5e0" />
          </pattern>
        </defs>
        <rect width="380" height="150" fill="url(#mini-dots)" />
        {[
          "M122 30 C136 30 136 75 150 75",
          "M122 75 C136 75 136 75 150 75",
          "M122 120 C136 120 136 75 150 75",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="#c8502a" strokeWidth="1.4" />
        ))}
        {["M246 75 C263 75 263 40 280 40", "M246 75 C263 75 263 110 280 110"].map((d) => (
          <path key={d} d={d} fill="none" stroke="#c8502a" strokeWidth="1.4" />
        ))}
        {[
          { x: 4, y: 16, t: "checkout.ts", w: 118 },
          { x: 4, y: 61, t: "orders.ts", w: 118 },
          { x: 4, y: 106, t: "retry-charges.ts", w: 118 },
          { x: 280, y: 26, t: "db.ts", w: 94 },
          { x: 280, y: 96, t: "logger.ts", w: 94 },
        ].map((n) => (
          <g key={n.t} transform={`translate(${n.x} ${n.y})`}>
            <rect width={n.w} height="28" rx="6" fill="#fff" stroke="#b9b5ab" />
            <text x="10" y="18" fontSize="10.5" className="font-mono" fill="#3a3833">
              {n.t}
            </text>
          </g>
        ))}
        <g transform="translate(150 59)">
          <rect width="96" height="32" rx="6" fill="#1a1915" />
          <text x="13" y="20" fontSize="11" fontWeight="500" className="font-sans" fill="#fafaf8">
            payments.ts
          </text>
        </g>
      </svg>

      <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-md border border-line text-[12px]">
        {[
          ["Lines", "412"],
          ["Used by", "3"],
          ["Complexity", "High"],
        ].map(([k, v]) => (
          <div key={k} className="px-3 py-2">
            <p className="text-[11px] text-faint">{k}</p>
            <p className="mt-0.5 font-medium text-ink">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthShell({ children, switchText, switchHref, switchLabel, asideTitle, asideBody }) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Archon home">
            <Logo />
          </Link>
          <p className="text-sm text-muted">
            {switchText}{" "}
            <Link href={switchHref} className="font-medium text-ink underline-offset-4 hover:underline">
              {switchLabel}
            </Link>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center py-14">
          <div className="rise w-full max-w-[380px]">{children}</div>
        </div>

        <p className="text-xs text-faint">© 2026 Archon</p>
      </div>

      <aside className="hidden flex-col justify-center border-l border-line bg-sunken px-12 py-12 lg:flex xl:px-20">
        <div className="mx-auto w-full max-w-[460px]">
          <h2 className="text-balance text-[30px] font-medium leading-[1.12] tracking-[-0.035em] text-ink">
            {asideTitle}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{asideBody}</p>
          <div className="mt-10">
            <MiniModuleCard />
          </div>
        </div>
      </aside>
    </div>
  );
}

