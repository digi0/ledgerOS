import Link from "next/link";
import { FileText, ShieldAlert } from "lucide-react";
import { listDocuments, listClients } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { inr } from "@/lib/fields";
import { TDS_SECTIONS } from "@/lib/parser/extractors/india";
import TdsRegisterFilters from "@/components/TdsRegisterFilters";

export const dynamic = "force-dynamic";

// ---- Indian FY / Quarter helpers ----------------------------------------

/**
 * Returns Indian FY string "YYYY-YY" from any ISO date.
 * FY runs April 1 → March 31.  E.g. 2024-07-01 → "2024-25", 2024-02-01 → "2023-24".
 */
function fyFromDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-indexed
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/** Returns "Q1"|"Q2"|"Q3"|"Q4" per Indian IT Act schedule. */
function quarterFromDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  if (m >= 4 && m <= 6) return "Q1";
  if (m >= 7 && m <= 9) return "Q2";
  if (m >= 10 && m <= 12) return "Q3";
  return "Q4"; // Jan–Mar
}

/** Generates the last N Indian FYs for the dropdown. */
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

// ---- Field helpers -------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Normalise quarter strings like "Q1", "quarter 1", "q-1" → "Q1"|"" */
function normaliseQuarter(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const m = raw.toUpperCase().match(/Q([1-4])/);
  return m ? `Q${m[1]}` : "";
}

// ---- Page ---------------------------------------------------------------

export default async function TdsRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to view the TDS register.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const clientId   = sp.client  ?? "";
  const filterFy   = sp.fy      ?? "";
  const filterQtr  = sp.quarter ?? "";
  const fyOptions  = recentFYs();

  const [clients, rawDocs] = await Promise.all([
    listClients(),
    listDocuments({
      classification: "tds_certificate",
      clientId: clientId || undefined,
      limit: 1000,
    }),
  ]);

  // Build register rows
  const allRows = rawDocs.map((d) => {
    const f = d.extracted_fields;

    // Derive date: TDS certs may carry quarter/fy but not always a full date.
    // Fall back to created_at for FY/quarter derivation when no explicit date.
    const docDate = str(f.fy
      ? ""         // 26AS has fy but not a single date — skip
      : f.date ?? d.created_at);

    const dateForFilter = docDate || d.created_at;
    const fy      = str(f.fy) || fyFromDate(dateForFilter);
    const quarter = normaliseQuarter(f.quarter) || quarterFromDate(dateForFilter);

    // Section info
    const section      = str(f.section);
    const sectionLabel = str(f.section_label) || (section ? (TDS_SECTIONS[section] ?? section) : "");

    // Amounts
    const amountPaid = num(f.amount_paid);
    const tdsAmount  = num(f.tds_amount);

    // Name: parser stores "deductee" which in practice captures the first
    // name-like line near TDS keywords — best effort without a richer parser.
    const name = str(f.deductee) || str(f.legal_name) || d.filename.replace(/\.[^.]+$/, "");

    return {
      docId:        d.id,
      clientName:   d.client?.name ?? "—",
      form:         str(f.form) || "16A",
      name,
      pan:          str(f.pan),
      section,
      sectionLabel,
      fy,
      quarter,
      amountPaid,
      tdsAmount,
    };
  });

  // Apply FY + quarter filters
  const rows = allRows.filter((r) => {
    if (filterFy  && r.fy      !== filterFy)  return false;
    if (filterQtr && r.quarter !== filterQtr) return false;
    return true;
  });

  // ---- Aggregations -------------------------------------------------------

  const totalCerts    = rows.length;
  const totalGross    = rows.reduce((s, r) => s + r.amountPaid, 0);
  const totalTds      = rows.reduce((s, r) => s + r.tdsAmount, 0);

  // Section-wise breakdown (only sections with at least 1 entry)
  const sectionMap = new Map<string, { label: string; count: number; gross: number; tds: number }>();
  for (const r of rows) {
    if (!r.section) continue;
    const existing = sectionMap.get(r.section) ?? {
      label: r.sectionLabel || r.section,
      count: 0,
      gross: 0,
      tds: 0,
    };
    sectionMap.set(r.section, {
      ...existing,
      count: existing.count + 1,
      gross: existing.gross + r.amountPaid,
      tds:   existing.tds   + r.tdsAmount,
    });
  }
  const sectionBreakdown = [...sectionMap.entries()]
    .sort((a, b) => b[1].tds - a[1].tds);

  // ---- Render -------------------------------------------------------------

  const statCards = [
    { label: "Certificates",     value: String(totalCerts),      color: "" },
    { label: "Gross Amount",     value: inr(totalGross) ?? "—",  color: "" },
    { label: "TDS Credit",       value: inr(totalTds)  ?? "—",   color: "text-[var(--color-ok)]" },
    {
      label: "Effective Rate",
      value: totalGross > 0 ? `${((totalTds / totalGross) * 100).toFixed(1)}%` : "—",
      color: "text-[var(--color-brand)]",
    },
  ];

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-[var(--color-fg-muted)]">
            <Link href="/tds/register" className="hover:underline">TDS</Link>
            {" / "}Register
          </p>
          <h1 className="font-display text-2xl">TDS Register</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            Auto-built from uploaded TDS certificates · Form 16 / 16A · 26AS
          </p>
        </div>
        <TdsRegisterFilters
          clients={clients}
          currentClient={clientId}
          currentFy={filterFy}
          currentQuarter={filterQtr}
          fyOptions={fyOptions}
        />
      </header>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              {s.label}
            </p>
            <p className={`mt-1 font-display text-xl text-[var(--color-ink)] ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Section-wise breakdown */}
      {sectionBreakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Section-wise summary
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                  <th className="px-4 py-2">Section</th>
                  <th className="px-4 py-2">Nature of payment</th>
                  <th className="px-4 py-2 text-right">Certificates</th>
                  <th className="px-4 py-2 text-right">Gross paid</th>
                  <th className="px-4 py-2 text-right">TDS credit</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {sectionBreakdown.map(([sec, agg]) => (
                  <tr
                    key={sec}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <td className="px-4 py-2">
                      <span className="glass-pill rounded-md px-2 py-0.5 text-[11px] font-semibold bg-[var(--color-warn-soft)] text-[var(--color-warn)]">
                        {sec}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[12px] text-[var(--color-fg)]">{agg.label}</td>
                    <td className="px-4 py-2 text-right text-[12px] tnum text-[var(--color-fg-muted)]">
                      {agg.count}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] tnum text-[var(--color-fg)]">
                      {inr(agg.gross) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[13px] font-semibold tnum text-[var(--color-ok)]">
                      {inr(agg.tds) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-[12px] tnum text-[var(--color-fg-muted)]">
                      {agg.gross > 0 ? `${((agg.tds / agg.gross) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
                  <td colSpan={3} className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                    Total
                  </td>
                  <td className="px-4 py-2 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                    {inr(totalGross) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-[14px] font-bold tnum text-[var(--color-ok)]">
                    {inr(totalTds) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-[12px] tnum text-[var(--color-fg-muted)]">
                    {totalGross > 0 ? `${((totalTds / totalGross) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Main register table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <div>
              <p className="text-[14px] font-medium text-[var(--color-ink)]">
                No TDS certificates found
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                {filterFy || filterQtr || clientId
                  ? "Try adjusting the filters above."
                  : "Upload Form 16, Form 16A, or Form 26AS on the Documents page — they appear here automatically."}
              </p>
            </div>
            <Link
              href="/documents"
              className="btn-glass mt-1 inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white"
            >
              Upload documents
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--color-border)] px-4 py-2.5">
              <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                {rows.length} certificate{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                    <th className="px-4 py-2.5">Form</th>
                    <th className="px-4 py-2.5">FY</th>
                    <th className="px-4 py-2.5">Qtr</th>
                    {!clientId && <th className="px-4 py-2.5">Client</th>}
                    <th className="px-4 py-2.5">Name / Deductor</th>
                    <th className="px-4 py-2.5">PAN</th>
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5 text-right">Gross paid</th>
                    <th className="px-4 py-2.5 text-right">TDS deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.docId}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                    >
                      <td className="px-4 py-2.5">
                        <span className="glass-pill rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]">
                          {r.form || "16A"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] tnum text-[var(--color-fg-muted)]">
                        {r.fy || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)]">
                        {r.quarter || "—"}
                      </td>
                      {!clientId && (
                        <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)]">
                          {r.clientName}
                        </td>
                      )}
                      <td className="max-w-[200px] truncate px-4 py-2.5">
                        <Link
                          href={`/documents/${r.docId}`}
                          className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline"
                        >
                          {r.name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                        {r.pan || "—"}
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
                      <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                        {r.amountPaid ? (inr(r.amountPaid) ?? "—") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ok)]">
                        {r.tdsAmount ? (inr(r.tdsAmount) ?? "—") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
                    <td
                      colSpan={clientId ? 6 : 7}
                      className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]"
                    >
                      Total · {rows.length} certificate{rows.length === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                      {inr(totalGross) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[14px] font-bold tnum text-[var(--color-ok)]">
                      {inr(totalTds) ?? "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-[12px] text-[var(--color-fg-dim)]">
        Next: cross-check this register against Form 26AS from the TRACES portal to identify
        unclaimed TDS credits before filing.
      </p>
    </div>
  );
}
