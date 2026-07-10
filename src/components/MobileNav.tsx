"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { navSections, isNavActive } from "./nav-config";

/**
 * Mobile navigation — the desktop Sidebar is hidden below md, so this is the
 * only way to move around on a phone. A hamburger in the header opens a
 * slide-in drawer built from the same nav config as the sidebar.
 */
export default function MobileNav({
  documentsBadge = 0,
  complianceBadge = 0,
  firmName = "Your Firm",
  showSignOut = false,
}: {
  documentsBadge?: number;
  complianceBadge?: number;
  firmName?: string;
  showSignOut?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sections = navSections({ documentsBadge, complianceBadge });

  // Close on route change, and lock body scroll while open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          {/* scrim */}
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          {/* drawer */}
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[82vw] flex-col bg-[var(--color-surface)] px-3.5 py-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between px-1.5">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
                <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--color-brand)] font-display text-sm text-white">L</span>
                <span className="leading-tight">
                  <span className="block font-display text-[15px] text-[var(--color-ink)]">LedgerOS</span>
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-dim)]">{firmName}</span>
                </span>
              </Link>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto no-scrollbar">
              {sections.map((sec) => (
                <div key={sec.title}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">{sec.title}</p>
                  <div className="space-y-0.5">
                    {sec.items.map((it) => {
                      const Icon = it.icon;
                      return (
                        <Link key={it.href} href={it.href} data-active={isNavActive(pathname, it.href)} className="nav-item text-[13px]">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{it.label}</span>
                          {it.badge ? (
                            <span className="rounded-full bg-[var(--color-alert-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-alert)]">{it.badge}</span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {showSignOut && (
              <form action={signOut} className="mt-3 border-t border-[var(--color-border)] pt-3">
                <button type="submit" className="nav-item w-full text-[13px]">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign out</span>
                </button>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
