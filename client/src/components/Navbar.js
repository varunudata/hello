"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-different", label: "Why it's different" },
  { href: "/#features", label: "Features" },
  { href: "/#faq", label: "FAQ" },
];

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("archon_user");
      if (saved) setUser(JSON.parse(saved));
    } catch {
      // storage unavailable — stay logged out
    }

    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signOut = () => {
    try {
      localStorage.removeItem("archon_token");
      localStorage.removeItem("archon_user");
    } catch {
      // ignore
    }
    setUser(null);
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-paper transition-colors duration-200 ${
        scrolled ? "border-line" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Archon home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <span className="px-3 text-sm text-muted">{user.name}</span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-md border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm text-ink-soft transition-colors hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
              >
                Get started free
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 p-2 text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
            {open ? (
              <path
                d="M5 5l10 10M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h14M3 10h14M3 14h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper px-6 pb-6 md:hidden">
          <nav className="flex flex-col py-2">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-[15px] text-ink-soft"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="col-span-2 rounded-md border border-line-strong bg-surface py-2.5 text-sm font-medium text-ink"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-md border border-line-strong bg-surface py-2.5 text-center text-sm font-medium text-ink"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-ink py-2.5 text-center text-sm font-medium text-paper"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
