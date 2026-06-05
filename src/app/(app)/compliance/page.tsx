import Link from "next/link";
import { listClients, listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { computeCompliance, daysUntil, type Deadline } from "@/lib/compliance";

export const dynamic = "force-dynamic";

/**
 * Compliance calendar — statutory GST/TDS/ITR deadlines generated from the
 * client book. A parsed GST return for the same form+period marks its
 * deadline Filed automatically.
 */
export default async function CompliancePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to view the calendar.</p>
      </div>
    );
  }

  const [clients, gstReturns] = await Promise.all([
    listClients(),
    listDocuments({ classification: "gst_return", limit: 500 }),
  ]);
  const items = computeCompliance({ clients, gstReturns, horizonDays: 60 });
  const overdue = items.filter((i) => i.status === "overdue").length;
  const gstClientCount = clients.filter((c) => c.gstin).length;

  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">Compliance</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Next 60 days · generated from {gstClientCount} GST-registered client
          {gstClientCount === 1 ? "" : "s"}
          {overdue > 0 && <span className="text-[var(--color-alert)]"> · {overdue} overdue</span>}
        </p>
      </header>

      <div className="card p-5">
        {items.length === 0 ? (
          <div className="grid place-items-center p-12 text-center">
            <div className="max-w-md">
              <h2 className="font-display text-lg">No deadlines to show</h2>
              <p className="mt-2 text-[var(--color-fg-muted)]">
                Deadlines are generated from your client book — add a client with a GSTIN and
                their GSTR-1/3B dates appear here automatically.
              </p>
              <Link
                href="/clients"
                className="mt-5 inline-flex rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
              >
                Add a client
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map((u, i) => (
              <DeadlineRow key={`${u.date}-${u.form}-${u.clientId ?? "firm"}-${i}`} item={u} />
            ))}
          </div>
        )}
      </div>

      <p className="text-[12px] text-[var(--color-fg-dim)]">
        v1 assumes monthly GST filers — QRMP (quarterly) becomes a per-client setting later.
        GSTR deadlines auto-mark Filed when the return PDF is ingested; TDS/ITR/advance-tax
        tracking arrives with those modules.
      </p>
    </div>
  );
}

function DeadlineRow({ item }: { item: Deadline }) {
  const d = new Date(item.date);
  const days = daysUntil(item.date);
  const chip =
    item.status === "filed"
      ? { text: "Filed", cls: "bg-[var(--color-ok-soft)] text-[var(--color-ok)]" }
      : item.status === "overdue"
        ? { text: `${Math.abs(days)}d overdue`, cls: "bg-[var(--color-alert-soft)] text-[var(--color-alert)]" }
        : days <= 7
          ? { text: days === 0 ? "today" : `${days}d`, cls: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]" }
          : { text: `${days}d`, cls: "bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]" };

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-[var(--color-surface-2)]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] leading-none">
        <span className="text-[14px] font-bold text-[var(--color-ink)]">{d.getDate()}</span>
        <span className="text-[9px] font-semibold uppercase text-[var(--color-fg-dim)]">
          {d.toLocaleDateString("en-IN", { month: "short" })}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">{item.label}</p>
        <p className="truncate text-[11px] text-[var(--color-fg-dim)]">
          {item.scope === "client" ? `${item.clientName} · ` : "Firm-wide · "}
          {item.detail}
        </p>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
        {chip.text}
      </span>
    </div>
  );
}
