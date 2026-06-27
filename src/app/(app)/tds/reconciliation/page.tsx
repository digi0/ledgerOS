import Link from "next/link";
import { serverAdmin } from "@/lib/supabase";
import { DEMO_FIRM_ID } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listDocuments, listClients } from "@/lib/db";
import { inr } from "@/lib/fields";
import { TDS_SECTIONS } from "@/lib/parser/extractors/india";
import { reconcile26as, type Recon26asRow, type ReconStatus26as } from "@/lib/form26as";
import TdsRegisterFilters from "@/components/TdsRegisterFilters";
import Form26asUpload from "@/components/Form26asUpload";

export const dynamic = "force-dynamic";

// ---- Shared helpers (same as TDS Register page) ----------------------------

function fyFromDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

function quarterFromDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  if (m >= 4 && m <= 6) return "Q1";
  if (m >= 7 && m <= 9) return "Q2";
  if (m >= 10 && m <= 12) return "Q3";
  return "Q4";
}

function recentFYs(n = 6): { value: string; label: string }[] {
  const now = new Date();
  const m = now.getMonth() + 1;
  const currentStart = m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: n }, (_, i) => {
    const start = currentStart - i;
    const value = `${start}-${String(start + 1).slice(-2)}`;
    return { value, label: `FY ${value}` };
  });
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : 0;
}

function normaliseQuarter(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const m = raw.toUpperCase().match(/Q([1-4])/);
  return m ? `Q${m[1]}` : "";
}

// ---- Status display ---------------------------------------------------------

const STATUS_LABEL: Record<ReconStatus26as, string> = {
  matched:         "Matched",
  amount_mismatch: "Mismatch",
  register_only:   "Chase deductor",
  "26as_only":     "Unclaimed credit",
};

const STATUS_STYLE: Record<ReconStatus26as, string> = {
  matched:         "bg-[var(--color-ok-soft)]    text-[var(--color-ok)]",
  amount_mismatch: "bg-[var(--color-warn-soft)]  text-[var(--color-warn)]",
  register_only:   "bg-[var(--color-alert-soft)] text-[var(--color-alert)]",
  "26as_only":     "bg-[var(--color-info-soft)]  text-[var(--color-info)]",
};

const STATUS_ROW: Record<ReconStatus26as, string> = {
  matched:         "",
  amount_mismatch: "bg-[var(--color-warn-soft)]/30",
  register_only:   "bg-[var(--color-alert-soft)]/30",
  "26as_only":     "bg-[var(--color-info-soft)]/20",
};

// ---- Page ------------------------------------------------------------------

export default async function TdsReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to use reconciliation.</p>
      </div>
    );
  }

  const sp          = await searchParams;
  const clientId    = sp.client  ?? "";
  const filterFy    = sp.fy      ?? "";
  const filterQtr   = sp.quarter ?? "";
  const fyOptions   = recentFYs();

  const [clients, invoiceDocs] = await Promise.all([
    listClients(),
    clientId
      ? listDocuments({ classification: "tds_certificate", clientId, limit: 1000 })
      : Promise.resolve([]),
  ]);

  // Fetch Form 26AS entries from DB
  const sb = serverAdmin();
  const { data: asRows } = clientId && filterFy
    ? await sb
        .from("form26as_entry")
        .select("*")
        .eq("firm_id", DEMO_FIRM_ID)
        .eq("client_id", clientId)
        .eq("fy", filterFy)
    : { data: [] };

  const twoSixAs = (asRows ?? []).map((r) => ({
    id:            r.id as string,
    part:          (r.part as string) || "A",
    deductorTan:   (r.deductor_tan   as string) ?? "",
    deductorName:  (r.deductor_name  as string) ?? "",
    section:       (r.section        as string) ?? "",
    quarter:       (r.quarter        as string) ?? "",
    amountPaid:    num(r.amount_paid),
    tdsDeducted:   num(r.tds_deducted),
    bookingStatus: (r.booking_status as string) ?? "",
  }));

  // Build TDS register entries filtered to the selected FY + quarter
  const regEntries = invoiceDocs
    .map((d) => {
      const f = d.extracted_fields;
      const dateForFilter = (typeof f.date === "string" ? f.date : null) ?? d.created_at;
      const fy      = (typeof f.fy === "string" ? f.fy : null) ?? fyFromDate(dateForFilter);
      const quarter = normaliseQuarter(f.quarter) || quarterFromDate(dateForFilter);
      return {
        docId:      d.id,
        name:       (typeof f.deductee    === "string" ? f.deductee    : null) ??
                    (typeof f.legal_name  === "string" ? f.legal_name  : null) ??
                    d.filename.replace(/\.[^.]+$/, ""),
        pan:        typeof f.pan === "string" ? f.pan : "",
        section:    typeof f.section === "string" ? f.section : "",
        quarter,
        fy,
        amountPaid: num(f.amount_paid),
        tdsAmount:  num(f.tds_amount),
      };
    })
    .filter((r) => {
      if (filterFy  && r.fy      !== filterFy)  return false;
      if (filterQtr && r.quarter !== filterQtr) return false;
      return true;
    });

  // Filter 26AS entries by quarter if requested
  const filteredAs = filterQtr
    ? twoSixAs.filter((e) => !e.quarter || e.quarter === filterQtr)
    : twoSixAs;

  const hasData = clientId && filterFy;
  const rows: Recon26asRow[] = hasData ? reconcile26as(regEntries, filteredAs) : [];

  // Counts
  const counts = {
    matched:         rows.filter((r) => r.status === "matched").length,
    amount_mismatch: rows.filter((r) => r.status === "amount_mismatch").length,
    register_only:   rows.filter((r) => r.status === "register_only").length,
    "26as_only":     rows.filter((r) => r.status === "26as_only").length,
  };

  // Credit summary
  const creditClaimable = rows
    .filter((r) => r.status === "matched")
    .reduce((s, r) => s + (r.as26?.tdsDeducted ?? 0), 0);
  const creditPending = rows
    .filter((r) => r.status === "26as_only")
    .reduce((s, r) => s + (r.as26?.tdsDeducted ?? 0), 0);
  const creditAtRisk = rows
    .filter((r) => r.status === "register_only")
    .reduce((s, r) => s + (r.reg?.tdsAmount ?? 0), 0);

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-[var(--color-fg-muted)]">
            <Link href="/tds" className="hover:underline">TDS</Link>
            {" / "}Reconciliation
          </p>
          <h1 className="font-display text-2xl">26AS Reconciliation</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            Match Form 16A certificates against TRACES Form 26AS to verify TDS credits
          </p>
        </div>
        <TdsRegisterFilters
          clients={clients}
          currentClient={clientId}
          currentFy={filterFy}
          currentQuarter={filterQtr}
          fyOptions={fyOptions}
          basePath="/tds/reconciliation"
        />
      </header>

      {!clientId || !filterFy ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-fg-muted)]">
            Select a client and financial year above to begin reconciliation.
          </p>
        </div>
      ) : twoSixAs.length === 0 ? (
        <Form26asUpload clientId={clientId} fy={filterFy} hasExisting={false} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { label: "Matched",        value: counts.matched,         style: "text-[var(--color-ok)]" },
                { label: "Chase deductor", value: counts.register_only,   style: "text-[var(--color-alert)]" },
                { label: "Unclaimed",      value: counts["26as_only"],    style: "text-[var(--color-info)]" },
                { label: "Mismatch",       value: counts.amount_mismatch, style: "text-[var(--color-warn)]" },
              ] as const
            ).map((s) => (
              <div key={s.label} className="card px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                  {s.label}
                </p>
                <p className={`mt-1 font-display text-2xl ${s.style}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Credit callout strip */}
          {(creditClaimable > 0 || creditPending > 0 || creditAtRisk > 0) && (
            <div className="flex flex-wrap gap-3">
              {creditClaimable > 0 && (
                <div className="rounded-lg bg-[var(--color-ok-soft)] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[var(--color-ok)]">
                    TDS credit confirmed: <strong>{inr(creditClaimable)}</strong>
                  </span>
                </div>
              )}
              {creditPending > 0 && (
                <div className="rounded-lg bg-[var(--color-info-soft)] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[var(--color-info)]">
                    Unclaimed in books: <strong>{inr(creditPending)}</strong> — book these receipts
                  </span>
                </div>
              )}
              {creditAtRisk > 0 && (
                <div className="rounded-lg bg-[var(--color-alert-soft)] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[var(--color-alert)]">
                    Credit at risk: <strong>{inr(creditAtRisk)}</strong> — deductor hasn&apos;t filed
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Reconciliation table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
              <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                {rows.length} entries
              </span>
              <Form26asUpload clientId={clientId} fy={filterFy} hasExisting />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5">Qtr</th>
                    <th className="px-4 py-2.5">Deductor</th>
                    <th className="px-4 py-2.5">TAN</th>
                    <th className="px-4 py-2.5 text-right">Register TDS</th>
                    <th className="px-4 py-2.5 text-right">26AS TDS</th>
                    <th className="px-4 py-2.5 text-right">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const diff =
                      r.as26 && r.reg
                        ? r.as26.tdsDeducted - r.reg.tdsAmount
                        : null;
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-[var(--color-border)] last:border-0 ${STATUS_ROW[r.status]}`}
                      >
                        <td className="px-4 py-2.5">
                          <span
                            className={`glass-pill rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status]}`}
                          >
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.section ? (
                            <span
                              className="glass-pill rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
                              title={r.sectionLabel}
                            >
                              {r.section}
                            </span>
                          ) : (
                            <span className="text-[12px] text-[var(--color-fg-dim)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)]">
                          {r.quarter || "—"}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2.5">
                          {r.reg?.docId ? (
                            <Link
                              href={`/documents/${r.reg.docId}`}
                              className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline"
                              title={r.deductorName}
                            >
                              {r.deductorName || "—"}
                            </Link>
                          ) : (
                            <span className="text-[13px] text-[var(--color-ink)]">
                              {r.deductorName || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                          {r.deductorTan || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                          {r.reg
                            ? (inr(r.reg.tdsAmount) ?? "—")
                            : <span className="text-[var(--color-fg-dim)]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                          {r.as26
                            ? (inr(r.as26.tdsDeducted) ?? "—")
                            : <span className="text-[var(--color-fg-dim)]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[13px] tnum">
                          {diff !== null ? (
                            <span
                              className={
                                Math.abs(diff) <= 2
                                  ? "text-[var(--color-ok)]"
                                  : diff > 0
                                  ? "text-[var(--color-info)]"
                                  : "text-[var(--color-alert)]"
                              }
                            >
                              {diff > 0 ? "+" : ""}
                              {inr(diff) ?? "—"}
                            </span>
                          ) : (
                            <span className="text-[var(--color-fg-dim)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Action guide
            </p>
            <ul className="mt-2 space-y-1 text-[12px] text-[var(--color-fg-muted)]">
              <li>
                <span className="font-semibold text-[var(--color-alert)]">Chase deductor</span>
                {" — "}you have Form 16A but it&apos;s not reflected in 26AS. Deductor may not have filed quarterly TDS return. Follow up for corrected Form 16A after their return is revised.
              </li>
              <li>
                <span className="font-semibold text-[var(--color-info)]">Unclaimed credit</span>
                {" — "}26AS shows TDS deducted but no matching Form 16A uploaded. Book the underlying income entry and claim the TDS credit.
              </li>
              <li>
                <span className="font-semibold text-[var(--color-warn)]">Mismatch</span>
                {" — "}section and quarter match but amounts differ. Verify the Form 16A amount against the payment vouchers; request a revised certificate if needed.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
