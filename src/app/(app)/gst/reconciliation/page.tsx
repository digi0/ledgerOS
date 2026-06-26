import Link from "next/link";
import { serverAdmin } from "@/lib/supabase";
import { DEMO_FIRM_ID } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/supabase";
import { listDocuments, listClients } from "@/lib/db";
import { inr } from "@/lib/fields";
import { reconcile, type ReconRow, type MatchStatus } from "@/lib/gstr2b";
import PurchaseRegisterFilters from "@/components/PurchaseRegisterFilters";
import Gstr2bUpload from "@/components/Gstr2bUpload";

export const dynamic = "force-dynamic";

function recentMonths(n = 13) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : 0;
}

const STATUS_LABEL: Record<MatchStatus, string> = {
  matched:         "Matched",
  amount_mismatch: "Amount mismatch",
  register_only:   "ITC at risk",
  "2b_only":       "Book it",
};

const STATUS_STYLE: Record<MatchStatus, string> = {
  matched:         "bg-[var(--color-ok-soft)] text-[var(--color-ok)]",
  amount_mismatch: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  register_only:   "bg-[var(--color-alert-soft)] text-[var(--color-alert)]",
  "2b_only":       "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

const STATUS_ROW: Record<MatchStatus, string> = {
  matched:         "",
  amount_mismatch: "bg-[var(--color-warn-soft)]/30",
  register_only:   "bg-[var(--color-alert-soft)]/30",
  "2b_only":       "bg-[var(--color-info-soft)]/20",
};

export default async function ReconciliationPage({
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

  const sp = await searchParams;
  const clientId = sp.client ?? "";
  const period   = sp.period ?? "";
  const periods  = recentMonths();

  const [clients, invoiceDocs] = await Promise.all([
    listClients(),
    clientId
      ? listDocuments({ classification: "invoice", clientId, limit: 500 })
      : Promise.resolve([]),
  ]);

  // Fetch GSTR-2B entries from DB
  const sb = serverAdmin();
  const { data: twoBRows } = clientId && period
    ? await sb
        .from("gstr2b_entry")
        .select("*")
        .eq("firm_id", DEMO_FIRM_ID)
        .eq("client_id", clientId)
        .eq("period", period)
    : { data: [] };

  const twoB = (twoBRows ?? []).map((r) => ({
    id:             r.id as string,
    supplierGstin:  r.supplier_gstin as string,
    supplierName:   (r.supplier_name as string) ?? "",
    invoiceNumber:  r.invoice_number as string,
    invoiceDate:    (r.invoice_date as string) ?? "",
    invoiceValue:   num(r.invoice_value),
    taxableValue:   num(r.taxable_value),
    cgst:           num(r.cgst),
    sgst:           num(r.sgst),
    igst:           num(r.igst),
  }));

  // Build register entries, filtered by period
  const regDocs = period
    ? invoiceDocs.filter((d) => {
        const date =
          typeof d.extracted_fields.date === "string"
            ? d.extracted_fields.date
            : d.created_at;
        return date.startsWith(period);
      })
    : invoiceDocs;

  const register = regDocs.map((d) => {
    const f = d.extracted_fields;
    return {
      docId:      d.id,
      gstin:      typeof f.gstin === "string" ? f.gstin : "",
      invoiceNo:  typeof f.invoice_number === "string" ? f.invoice_number : "",
      date:       typeof f.date === "string" ? f.date : d.created_at,
      taxable:    num(f.taxable_value),
      cgst:       num(f.cgst),
      sgst:       num(f.sgst),
      igst:       num(f.igst),
      total:      num(f.total),
      vendor:     typeof f.vendor_name === "string" ? f.vendor_name : "—",
      clientName: d.client?.name ?? "—",
    };
  });

  const hasData = clientId && period;
  const rows: ReconRow[] = hasData ? reconcile(register, twoB) : [];

  // Counts by status
  const counts = {
    matched:         rows.filter((r) => r.status === "matched").length,
    amount_mismatch: rows.filter((r) => r.status === "amount_mismatch").length,
    register_only:   rows.filter((r) => r.status === "register_only").length,
    "2b_only":       rows.filter((r) => r.status === "2b_only").length,
  };

  // ITC summary
  const itcAvailable = rows
    .filter((r) => r.status === "matched" || r.status === "amount_mismatch")
    .reduce((s, r) => s + (r.twoB?.cgst ?? 0) + (r.twoB?.sgst ?? 0) + (r.twoB?.igst ?? 0), 0);
  const itcAtRisk = rows
    .filter((r) => r.status === "register_only")
    .reduce((s, r) => s + (r.reg?.cgst ?? 0) + (r.reg?.sgst ?? 0) + (r.reg?.igst ?? 0), 0);

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-[var(--color-fg-muted)]">
            <Link href="/gst" className="hover:underline">GST</Link>
            {" / "}Reconciliation
          </p>
          <h1 className="font-display text-2xl">GSTR-2B Reconciliation</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            Match supplier invoices in GSTR-2B against your purchase register
          </p>
        </div>
        <PurchaseRegisterFilters
          clients={clients}
          currentClient={clientId}
          currentPeriod={period}
          periods={periods}
        />
      </header>

      {!clientId || !period ? (
        <div className="card p-8 text-center">
          <p className="text-[var(--color-fg-muted)]">
            Select a client and period above to begin reconciliation.
          </p>
        </div>
      ) : twoB.length === 0 ? (
        <Gstr2bUpload clientId={clientId} period={period} hasExisting={false} />
      ) : (
        <>
          {/* ITC summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { label: "Matched", value: counts.matched, style: "text-[var(--color-ok)]" },
                { label: "ITC at risk", value: counts.register_only, style: "text-[var(--color-alert)]" },
                { label: "To book", value: counts["2b_only"], style: "text-[var(--color-info)]" },
                { label: "Mismatch", value: counts.amount_mismatch, style: "text-[var(--color-warn)]" },
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

          {/* ITC callout */}
          {(itcAvailable > 0 || itcAtRisk > 0) && (
            <div className="flex flex-wrap gap-3">
              {itcAvailable > 0 && (
                <div className="rounded-lg bg-[var(--color-ok-soft)] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[var(--color-ok)]">
                    ITC claimable: <strong>{inr(itcAvailable)}</strong>
                  </span>
                </div>
              )}
              {itcAtRisk > 0 && (
                <div className="rounded-lg bg-[var(--color-alert-soft)] px-4 py-2.5">
                  <span className="text-[12px] font-medium text-[var(--color-alert)]">
                    ITC at risk: <strong>{inr(itcAtRisk)}</strong> — suppliers haven't filed yet
                  </span>
                </div>
          )}
            </div>
          )}

          {/* Reconciliation table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
              <span className="text-[13px] font-semibold text-[var(--color-ink)]">
                {rows.length} invoices
              </span>
              <Gstr2bUpload clientId={clientId} period={period} hasExisting />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Invoice No.</th>
                    <th className="px-4 py-2.5">Vendor</th>
                    <th className="px-4 py-2.5">GSTIN</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Register ₹</th>
                    <th className="px-4 py-2.5 text-right">GSTR-2B ₹</th>
                    <th className="px-4 py-2.5 text-right">GST (2B)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-[var(--color-border)] last:border-0 ${STATUS_ROW[r.status]}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`glass-pill rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.reg?.docId ? (
                          <Link
                            href={`/documents/${r.reg.docId}`}
                            className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline"
                          >
                            {r.invoiceNo || "—"}
                          </Link>
                        ) : (
                          <span className="text-[13px] font-medium text-[var(--color-ink)]">
                            {r.invoiceNo || "—"}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-[13px] text-[var(--color-fg)]">
                        {r.vendorName || "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                        {r.gstin || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] tnum text-[var(--color-fg-muted)]">
                        {r.invoiceDate || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                        {r.reg ? (inr(r.reg.total) ?? "—") : <span className="text-[var(--color-fg-dim)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                        {r.twoB ? (inr(r.twoB.invoiceValue) ?? "—") : <span className="text-[var(--color-fg-dim)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                        {r.twoB
                          ? (inr(r.twoB.cgst + r.twoB.sgst + r.twoB.igst) ?? "—")
                          : r.reg
                          ? (inr(r.reg.cgst + r.reg.sgst + r.reg.igst) ?? "—")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
