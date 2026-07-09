"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutGrid, FileText, Users, BadgePercent, Landmark, Building2,
  CalendarCheck2, Receipt, GitCompareArrows, FileJson, FileCode, Sparkles, FilePlus2, ArrowRight,
} from "lucide-react";

type Icon = React.ComponentType<{ className?: string }>;
interface Cmd {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  keywords?: string;
  icon: Icon;
  href: string;
  /** Shown in the resting (no-query) list; secondary commands appear on search. */
  primary?: boolean;
}

/**
 * ⌘K command palette — the "one surface" glue. Fuzzy-jump to any page, any
 * client, or a client action (raise invoice / generate GSTR-1). Fully
 * keyboard-driven; the topbar search chip opens it.
 */
export default function CommandPalette({
  clients,
}: {
  clients: { id: string; name: string; gstin: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Cmd[]>(() => {
    const nav: [string, string, Icon][] = [
      ["/", "Dashboard", LayoutGrid],
      ["/documents", "Documents", FileText],
      ["/clients", "Clients", Users],
      ["/gst", "GST", BadgePercent],
      ["/tds", "TDS", Landmark],
      ["/income-tax", "Income Tax", Building2],
      ["/compliance", "Compliance", CalendarCheck2],
      ["/purchase-register", "Purchase Register", Receipt],
      ["/tds/register", "TDS Register", Landmark],
      ["/gst/reconciliation", "GSTR-2B Recon", GitCompareArrows],
      ["/tds/reconciliation", "26AS Recon", GitCompareArrows],
      ["/export/tally", "Export to Tally", FileCode],
      ["/gst/gstr1", "Generate GSTR-1", FileJson],
      ["/copilot", "AI Copilot", Sparkles],
    ];
    const navCmds: Cmd[] = nav.map(([href, title, icon]) => ({
      id: `nav:${href}`, title, group: "Go to", icon, href, primary: true, keywords: "page navigate open",
    }));
    const clientCmds: Cmd[] = clients.flatMap((c) => [
      { id: `client:${c.id}`, title: c.name, subtitle: c.gstin ?? undefined, group: "Clients", icon: Users, href: `/clients/${c.id}`, primary: true, keywords: c.gstin ?? "" },
      { id: `inv:${c.id}`, title: `Raise invoice — ${c.name}`, group: "Actions", icon: FilePlus2, href: `/clients/${c.id}/invoice/new`, keywords: "new bill gst" },
      { id: `gstr1:${c.id}`, title: `Generate GSTR-1 — ${c.name}`, group: "Actions", icon: FileJson, href: `/gst/gstr1?client=${c.id}`, keywords: "return file outward" },
      { id: `tally:${c.id}`, title: `Export to Tally — ${c.name}`, group: "Actions", icon: FileCode, href: `/export/tally?client=${c.id}`, keywords: "voucher xml import purchase" },
    ]);
    return [...navCmds, ...clientCmds];
  }, [clients]);

  const results = useMemo(() => {
    const query = q.toLowerCase().trim();
    const base = query ? commands : commands.filter((c) => c.primary);
    if (!query) return base;
    const tokens = query.split(/\s+/);
    return base
      .map((c) => {
        const hay = `${c.title} ${c.subtitle ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return null;
        let s = 0;
        const title = c.title.toLowerCase();
        if (title.startsWith(query)) s += 4;
        else if (title.includes(query)) s += 2;
        return { c, s };
      })
      .filter((x): x is { c: Cmd; s: number } => x !== null)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [q, commands]);

  const close = useCallback(() => { setOpen(false); setQ(""); setSel(0); }, []);

  const run = useCallback((cmd?: Cmd) => {
    if (!cmd) return;
    close();
    router.push(cmd.href);
  }, [close, router]);

  // ⌘K / Ctrl+K to open, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape" && open) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => { if (open) { setSel(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(results[sel]); }
  }

  return (
    <>
      {/* Trigger — mirrors the old search field */}
      <button
        onClick={() => setOpen(true)}
        className="group relative flex max-w-xl flex-1 items-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-9 pr-16 text-left text-[13px] text-[var(--color-fg-dim)] hover:border-[var(--color-border-strong)]"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-dim)]" />
        Search clients, documents, actions…
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-fg-dim)]">⌘ K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(15,23,42,0.35)] px-4 pt-[12vh]" onClick={close}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4">
              <Search className="h-4 w-4 text-[var(--color-fg-dim)]" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Jump to a client, page, or action…"
                className="h-12 flex-1 bg-transparent text-[14px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-dim)]"
              />
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">No matches.</p>
              ) : (
                results.map((cmd, i) => {
                  const prev = results[i - 1];
                  const header = !prev || prev.group !== cmd.group ? cmd.group : null;
                  const Icon = cmd.icon;
                  const active = i === sel;
                  return (
                    <div key={cmd.id}>
                      {header && (
                        <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">{header}</p>
                      )}
                      <button
                        data-idx={i}
                        onMouseMove={() => setSel(i)}
                        onClick={() => run(cmd)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left ${active ? "bg-[var(--color-surface-2)]" : ""}`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[var(--color-brand)]" : "text-[var(--color-fg-dim)]"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-[var(--color-ink)]">{cmd.title}</span>
                          {cmd.subtitle && <span className="block truncate font-mono text-[11px] text-[var(--color-fg-dim)]">{cmd.subtitle}</span>}
                        </span>
                        {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-dim)]" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-fg-dim)]">
              <span><kbd className="rounded border border-[var(--color-border)] px-1">↑↓</kbd> navigate</span>
              <span><kbd className="rounded border border-[var(--color-border)] px-1">↵</kbd> open</span>
              <span><kbd className="rounded border border-[var(--color-border)] px-1">esc</kbd> close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
