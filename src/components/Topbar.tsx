import { Search } from "lucide-react";

/**
 * Top command-search bar. The search field is presentational for now — it
 * mirrors the reference design; wiring global search lands with the copilot.
 */
export default function Topbar({ userName = "there" }: { userName?: string }) {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-6 py-3 lg:px-8">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-dim)]" />
          <input
            placeholder="Search clients, documents, notices, transactions…"
            className="w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2 pl-9 pr-16 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-brand)]"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-fg-dim)]">
            ⌘ K
          </kbd>
        </div>
        <p className="ml-auto hidden text-[13px] text-[var(--color-fg-muted)] sm:block">
          {greeting}, <span className="font-semibold text-[var(--color-ink)]">{userName}</span> ·{" "}
          {date}
        </p>
      </div>
    </header>
  );
}
