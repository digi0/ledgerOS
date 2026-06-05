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
  const unmatched = docs.filter((d) => !d.client_id).length;
  const returnsOnFile = docs.filter((d) => d.classification === "gst_return").length;

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
              { href: "/copilot", n: 2, title: "Ask the copilot", sub: "grounded in your documents" },
              { href: "/clients", n: 3, title: "Add your clients", sub: "uploads auto-match to them" },
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
          <p className="font-display text-3xl text-[var(--color-ink)]">{docs.length}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Documents ingested
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
        <Stat label="Unmatched Documents" value={String(unmatched)} sub="assign a client from the inbox" />
        <Stat label="ITC at Risk" value={inr(itcAtRisk) ?? "₹0"} sub={`${counts.new} new in inbox`} warn />
      </section>

      {/* two columns */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* upcoming compliance */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-[15px]">Upcoming Compliance</h3>
            <span className="text-[11px] text-[var(--color-fg-dim)]">Coming with the compliance module</span>
          </div>
          <p className="rounded-lg bg-[var(--color-surface-2)] p-4 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            No calendar yet — deadlines will be generated from each client&apos;s GSTIN and
            filing frequency once the compliance module lands. Until then, due dates parsed
            from notices appear on the documents themselves.
          </p>
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
          <h3 className="font-display text-[15px]">Returns on File</h3>
          <p className="mt-6 font-display text-3xl text-[var(--color-ink)]">{returnsOnFile}</p>
          <p className="mt-1 text-[12px] text-[var(--color-fg-muted)]">
            GST returns ingested · parsed from your uploads
          </p>
        </div>
        <div className="card p-5">
          <h3 className="font-display text-[15px]">Revenue Pulse</h3>
          <p className="mt-3 rounded-lg bg-[var(--color-surface-2)] p-4 text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            Not wired yet — revenue tracking arrives with the firm module. Nothing shown here
            until it&apos;s real.
          </p>
        </div>
        <div className="card space-y-3 p-5">
          <h3 className="font-display text-[15px]">AI Copilot</h3>
          {counts.new > 0 && (
            <div className="rounded-lg bg-[var(--color-warn-soft)] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warn)]">
                <TriangleAlert className="h-3 w-3" /> Attention
              </p>
              <p className="mt-1 text-[12px] text-[var(--color-fg)]">
                {counts.new} document{counts.new > 1 ? "s" : ""} in the inbox awaiting review.
              </p>
            </div>
          )}
          <Link href="/copilot" className="block rounded-lg bg-[var(--color-brand-soft)] p-3 hover:bg-[var(--color-brand-tint)]">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-strong)]">
              <Sparkles className="h-3 w-3" /> Ask anything
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-fg)]">
              The copilot answers from your parsed documents — try &quot;what was the GST
              liability in April?&quot;
            </p>
          </Link>
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

