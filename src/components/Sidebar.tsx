"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import { navSections } from "./nav-config";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({
  documentsBadge = 0,
  complianceBadge = 0,
  firmName = "Your Firm",
  clientCount = 0,
  showSignOut = false,
}: {
  documentsBadge?: number;
  complianceBadge?: number;
  firmName?: string;
  clientCount?: number;
  showSignOut?: boolean;
}) {
  const pathname = usePathname();

  const sections = navSections({ documentsBadge, complianceBadge });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col justify-between border-r border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-4 md:flex">
      <div>
        {/* brand */}
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-1.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--color-brand)] font-display text-sm text-white">
            L
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] text-[var(--color-ink)]">LedgerOS</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-dim)]">
              for CA practices
            </span>
          </span>
        </Link>

        <nav className="space-y-5">
          {sections.map((sec) => (
            <div key={sec.title}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                {sec.title}
              </p>
              <div className="space-y-0.5">
                {sec.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      data-active={isActive(it.href)}
                      className="nav-item text-[13px]"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{it.label}</span>
                      {it.badge ? (
                        <span className="rounded-full bg-[var(--color-alert-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-alert)]">
                          {it.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* firm card */}
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--color-brand)] text-sm font-semibold text-white">
          {firmName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold text-[var(--color-ink)]">{firmName}</p>
          <p className="truncate text-[11px] text-[var(--color-fg-dim)]">
            CA · {clientCount} active client{clientCount === 1 ? "" : "s"}
          </p>
        </div>
        <ThemeToggle />
        {showSignOut && (
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
