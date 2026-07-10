"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FileText, ArrowLeftRight } from "lucide-react";
import { exitBusiness } from "@/lib/business-actions";
import ThemeToggle from "./ThemeToggle";

/**
 * The business-side shell — a light top-nav chrome for an SME owner, distinct
 * from the CA's dense sidebar cockpit. Shows which business you're acting as
 * and who their accountant is, then a slim nav (dashboard, invoices).
 */
export default function BusinessShell({
  businessName,
  gstin,
  firmName,
  children,
}: {
  businessName: string;
  gstin: string | null;
  firmName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nav = [
    { href: "/business", label: "Dashboard", icon: LayoutGrid, exact: true },
    { href: "/business/invoices", label: "Invoices", icon: FileText, exact: false },
  ];
  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-6 py-3">
          {/* Brand + business identity */}
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--color-brand)] font-display text-sm text-white">L</span>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold text-[var(--color-ink)]">{businessName}</p>
              <p className="text-[11px] text-[var(--color-fg-dim)]">
                {gstin ? <span className="font-mono">{gstin}</span> : "No GSTIN on file"} · books shared with {firmName}
              </p>
            </div>
          </div>

          {/* Nav + actions */}
          <div className="flex items-center gap-1">
            <nav className="mr-2 hidden items-center gap-1 sm:flex">
              {nav.map((it) => {
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    data-active={isActive(it.href, it.exact)}
                    className="nav-item text-[13px]"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{it.label}</span>
                  </Link>
                );
              })}
            </nav>
            <ThemeToggle />
            <form action={exitBusiness}>
              <button
                type="submit"
                title="Switch to a different business"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Switch business</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
