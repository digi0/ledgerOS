import Link from "next/link";
import { Sparkles, TriangleAlert } from "lucide-react";
import { getMe, inboxCounts, listClients, listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CLASSIFICATION_LABELS } from "@/lib/types";
import { inr, timeAgo } from "@/lib/fields";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <h2 className="font-display text-lg">Connect Supabase</h2>
        <p className="mt-1 text-[var(--color-fg-muted)]">Add your keys to .env.local.</p>
      </div>
    );
  }

  const [docs, clients, counts, me] = await Promise.all([
    listDocuments({ limit: 500 }),
    listClients(),
    inboxCounts(),
    getMe(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const processedToday = docs.filter((d) => d.created_at.slice(0, 10) === today).length;
  const itcAtRisk = docs
    .filter((d) => d.classification === "notice")
    .reduce((s, d) => s + Number((d.extracted_fields as Record<string, unknown>).amount_disputed ?? 0), 0);
  const recent = docs.slice(0, 7);

  const fullDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">Dashboard</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Here&apos;s what&apos;s happening across your practice — {fullDate}
        </p>
      </header>

      {/* welcome */}
      <section className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg">Welcome to LedgerOS, {me.firmName}.</h2>
          <p className="mt-1 max-w-2xl text-[var(--color-fg-muted)]">
            Your workspace is live — wired to your real Supabase data. Three quick ways to see how
            LedgerOS handles your workflow:
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                href: "/documents",
                n: 1,
                title: `Process ${counts.new} documents`,
                sub: "AI-classified inbox · one click",
              },
              { href: "/gst", n: 2, title: "Reconcile GST", sub: "mismatches · ITC at risk" },
              { href: "/income-tax", n: 3, title: "Compare ITR regimes", sub: "savings, visualised" },
            ].map((c) => (
              <Link
                key={c.n}
                href={c.href}
                className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-border-strong)]"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-[11px] font-semibold text-white">
                  {c.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-[var(--color-ink)]">
                    {c.title}
                  </span>
                  <span className="block text-[11px] text-[var(--color-fg-dim)]">{c.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-7 py-5 text-center">
          <p className="font-display text-3xl text-[var(--color-ink)]">87h</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Saved this month
          </p>
        </div>
      </section>

      {/* live ticker — continuously scrolling marquee */}
      <div className="card flex items-center gap-4 overflow-hidden px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ok)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-ok)]" /> Live
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max items-center gap-7 animate-ticker">
            {[...recent, ...recent].map((d, i) => (
              <span
                key={`${d.id}-${i}`}
                className="whitespace-nowrap text-[12px] text-[var(--color-fg-muted)]"
              >
                <span className="font-medium text-[var(--color-ink)]">
                  {d.client?.name ?? "Unmatched"}
                </span>{" "}
                · {CLASSIFICATION_LABELS[d.classification]} · {d.filename}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active Clients" value={String(clients.length)} sub="all onboarded" />
        <Stat label="Docs Processed Today" value={String(processedToday)} sub="live ingestion" ok />
        <Stat label="Pending Compliance" value="4" sub="Next: GSTR-3B · Apr 20" />
        <Stat label="ITC at Risk" value={inr(itcAtRisk) ?? "₹0"} sub={`${counts.new} new in inbox`} warn />
      </section>

      {/* two columns */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* upcoming compliance */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[15px]">Upcoming Compliance</h3>
            <span className="text-[11px] text-[var(--color-fg-dim)]">Next 15 days · View all</span>
          </div>
          <div className="space-y-1">
            {UPCOMING.map((u) => (
              <div
                key={u.title}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-[var(--color-surface-2)]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] leading-none">
                  <span className="text-[14px] font-bold text-[var(--color-ink)]">{u.day}</span>
                  <span className="text-[9px] font-semibold uppercase text-[var(--color-fg-dim)]">
                    {u.mon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">{u.title}</p>
                  <p className="truncate text-[11px] text-[var(--color-fg-dim)]">{u.sub}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${u.cls}`}
                >
                  {u.due}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* recent activity */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[15px]">Recent Activity</h3>
            <span className="text-[11px] text-[var(--color-fg-dim)]">Live · now</span>
          </div>
          <div className="space-y-3.5">
            {recent.map((d) => (
              <div key={d.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-ok)]" />
                <div className="min-w-0">
                  <p className="text-[13px] text-[var(--color-fg)]">
                    {CLASSIFICATION_LABELS[d.classification]} ·{" "}
                    <span className="font-medium text-[var(--color-ink)]">
                      {d.client?.name ?? "Unmatched"}
                    </span>
                  </p>
                  <p className="text-[11px] text-[var(--color-fg-dim)]">
                    {d.filename} · {timeAgo(d.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* client health */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[15px]">Client Health</h3>
          <Link href="/clients" className="text-[11px] text-[var(--color-fg-dim)] hover:text-[var(--color-ink)]">
            Open client book
          </Link>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              <th className="pb-2 font-semibold">Client</th>
              <th className="pb-2 font-semibold">Health</th>
              <th className="pb-2 font-semibold">Pending</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const pending = docs.filter(
                (d) => d.client_id === c.id && d.handling !== "handled",
              ).length;
              const health = pending === 0 ? 1 : pending <= 1 ? 0.6 : 0.3;
              return (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[11px] font-semibold text-[var(--color-fg-muted)]">
                        {initials(c.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                          {c.name}
                        </p>
                        <p className="font-mono text-[11px] text-[var(--color-fg-dim)]">
                          {c.gstin ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${health * 100}%`,
                          background:
                            health >= 1
                              ? "var(--color-ok)"
                              : health >= 0.6
                                ? "var(--color-warn)"
                                : "var(--color-alert)",
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-3 text-[13px]">
                    {pending === 0 ? (
                      <span className="text-[var(--color-ok)]">On track</span>
                    ) : (
                      <span className="font-medium text-[var(--color-warn)]">
                        {pending} doc{pending > 1 ? "s" : ""} pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/documents?client=${c.id}`}
                      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* bottom row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="font-display text-[15px]">Filings This Quarter</h3>
          <p className="mt-6 font-display text-3xl text-[var(--color-ink)]">47</p>
          <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
            Returns filed this quarter · <span className="text-[var(--color-ok)]">100% on time</span>
          </p>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-[15px]">Revenue Pulse</h3>
          <p className="mt-3 font-display text-2xl text-[var(--color-ink)] tnum">₹ 3,24,600</p>
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            Monthly retainer · <span className="text-[var(--color-ok)]">▲ 12%</span>
          </p>
          <div className="mt-3 space-y-1.5 text-[12px]">
            {[
              ["Compliance retainer", "₹ 2,10,000"],
              ["Advisory", "₹ 80,000"],
              ["One-off filings", "₹ 34,600"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-[var(--color-fg-muted)]">{k}</span>
                <span className="tnum font-medium text-[var(--color-ink)]">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-display text-[15px]">AI Insights</h3>
          <div className="rounded-lg bg-[var(--color-ok-soft)] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ok)]">
              <Sparkles className="h-3 w-3" /> Opportunity
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-fg)]">
              Patel Textiles is paying 18% GST on items that may qualify for 12%. Worth a review.
            </p>
          </div>
          <div className="rounded-lg bg-[var(--color-warn-soft)] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warn)]">
              <TriangleAlert className="h-3 w-3" /> Attention
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-fg)]">
              {counts.new} documents are unprocessed in the inbox. Run the AI classifier to route them.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  ok,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-[var(--color-fg-muted)]">{label}</p>
      <p className="mt-1.5 font-display text-2xl text-[var(--color-ink)] tnum">{value}</p>
      <p
        className={`mt-1 text-[11px] ${
          ok ? "text-[var(--color-ok)]" : warn ? "text-[var(--color-warn)]" : "text-[var(--color-fg-dim)]"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const UPCOMING = [
  {
    day: "20",
    mon: "Apr",
    title: "GSTR-3B · Monthly Return",
    sub: "9 clients · 3 pending reconciliation",
    due: "2 days",
    cls: "bg-[var(--color-alert-soft)] text-[var(--color-alert)]",
  },
  {
    day: "30",
    mon: "Apr",
    title: "TDS Return · Q4 FY25-26",
    sub: "Form 24Q & 26Q · 7 deductor clients",
    due: "12 days",
    cls: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  },
  {
    day: "11",
    mon: "May",
    title: "GSTR-1 · Outward Supplies",
    sub: "B2B + B2C · auto-draft ready for 8 clients",
    due: "23 days",
    cls: "bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]",
  },
  {
    day: "31",
    mon: "Jul",
    title: "ITR Filing · AY 2026-27",
    sub: "Non-audit · 4 clients · AIS fetched",
    due: "104 days",
    cls: "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
  },
];
