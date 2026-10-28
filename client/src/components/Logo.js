export function LogoMark({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#1a1915" />
      <path
        d="M8 8.5 16 12 8 15.5"
        fill="none"
        stroke="#fafaf8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8.5" r="2" fill="#fafaf8" />
      <circle cx="8" cy="15.5" r="2" fill="#fafaf8" />
      <circle cx="16" cy="12" r="2.25" fill="#c8502a" />
    </svg>
  );
}

export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Archon
      </span>
    </span>
  );
}

