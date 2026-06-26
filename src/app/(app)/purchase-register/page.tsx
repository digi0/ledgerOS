import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { listDocuments, listClients } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { inr } from "@/lib/fields";
import PurchaseRegisterFilters from "@/components/PurchaseRegisterFilters";

export const dynamic = "force-dynamic";

/** Last N months as YYYY-MM values for the period selector. */
function recentMonths(n = 13): { value: string; label: string }[] {
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

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "—";
}

export default async function PurchaseRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to view the purchase register.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const clientId = sp.client ?? "";
  const period = sp.period ?? "";

  const [clients, rawDocs] = await Promise.all([
    listClients(),
    listDocuments({ classification: "invoice", clientId: clientId || undefined, limit: 500 }),
  ]);

  const periods = recentMonths();

  // Filter by period — extracted_fields.date is ISO YYYY-MM-DD; fall back to created_at
  const docs = period
    ? rawDocs.filter((d) => {
        const date =
          typeof d.extracted_fields.date === "string"
            ? d.extracted_fields.date
            : d.created_at;
        return date.startsWith(period);
      })
    : rawDocs;

  // Map to register rows
  const rows = docs.map((d) => {
    const f = d.extracted_fields;
    const cgst = num(f.cgst);
    const sgst = num(f.sgst);
    const igst = num(f.igst);
    return {
      docId: d.id,
      filename: d.filename,
      clientName: d.client?.name ?? "—",
      vendor: str(f.vendor_name),
      gstin: str(f.gstin),
      invoiceNo: str(f.invoice_number),
      date: str(f.date),
      taxable: num(f.taxable_value),
      cgst,
      sgst,
      igst,
      totalGst: cgst + sgst + igst,
      total: num(f.total),
    };
  });

  // Totals
  const T = rows.reduce(
    (acc, r) => ({
      taxable: acc.taxable + r.taxable,
      cgst: acc.cgst + r.cgst,
      sgst: acc.sgst + r.sgst,
      igst: acc.igst + r.igst,
      totalGst: acc.totalGst + r.totalGst,
      total: acc.total + r.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, total: 0 },
  );

  const statCards = [
    { label: "Invoices", value: String(rows.length), highlight: false },
    { label: "Taxable Value", value: inr(T.taxable) ?? "—", highlight: false },
    { label: "Total GST", value: inr(T.totalGst) ?? "—", highlight: false },
    { label: "Invoice Value", value: inr(T.total) ?? "—", highlight: true },
  ];

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Purchase Register</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            Auto-built from uploaded invoices · foundation for GSTR-2B reconciliation
          </p>
        </div>
        <PurchaseRegisterFilters
          clients={clients}
          currentClient={clientId}
          currentPeriod={period}
          periods={periods}
        />
      </header>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`card px-4 py-3 ${s.highlight ? "ring-1 ring-[var(--color-brand)]/20" : ""}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              {s.label}
            </p>
            <p className="mt-1 font-display text-xl text-[var(--color-ink)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Register table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingCart className="h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <div>
              <p className="text-[14px] font-medium text-[var(--color-ink)]">No invoices found</p>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                {period || clientId
                  ? "Try a different client or period filter."
                  : "Upload GST invoices on the Documents page — they appear here automatically."}
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Invoice No.</th>
                  {!clientId && <th className="px-4 py-2.5">Client</th>}
                  <th className="px-4 py-2.5">Vendor</th>
                  <th className="px-4 py-2.5">GSTIN</th>
                  <th className="px-4 py-2.5 text-right">Taxable</th>
                  <th className="px-4 py-2.5 text-right">CGST</th>
                  <th className="px-4 py-2.5 text-right">SGST</th>
                  <th className="px-4 py-2.5 text-right">IGST</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.docId}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)] tnum">
                      {r.date}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/documents/${r.docId}`}
                        className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline"
                      >
                        {r.invoiceNo}
                      </Link>
                    </td>
                    {!clientId && (
                      <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)]">
                        {r.clientName}
                      </td>
                    )}
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-[13px] text-[var(--color-fg)]">
                      {r.vendor}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-fg-muted)]">
                      {r.gstin}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                      {inr(r.taxable) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                      {r.cgst ? (inr(r.cgst) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                      {r.sgst ? (inr(r.sgst) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] tnum text-[var(--color-fg)]">
                      {r.igst ? (inr(r.igst) ?? "—") : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                      {inr(r.total) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
                  <td
                    colSpan={clientId ? 4 : 5}
                    className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]"
                  >
                    Total · {rows.length} invoice{rows.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                    {inr(T.taxable) ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                    {T.cgst ? (inr(T.cgst) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                    {T.sgst ? (inr(T.sgst) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">
                    {T.igst ? (inr(T.igst) ?? "—") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[14px] font-bold tnum text-[var(--color-ink)]">
                    {inr(T.total) ?? "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[12px] text-[var(--color-fg-dim)]">
        Next: GSTR-2B vs purchase register reconciliation — upload a GSTR-2B JSON/Excel to
        match supplier invoices against this register.
      </p>
    </div>
  );
}
