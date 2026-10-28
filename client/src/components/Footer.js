import Link from "next/link";
import Logo from "./Logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Create account", href: "/signup" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-12">
        <div className="md:col-span-6">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            A map of your codebase, so you can change it with confidence.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className="md:col-span-3">
            <p className="text-[13px] font-medium text-ink">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-line px-6 py-6 text-[13px] text-faint">
        <span>© 2026 Archon</span>
        <span>Made for people who read code.</span>
      </div>
    </footer>
  );
}

