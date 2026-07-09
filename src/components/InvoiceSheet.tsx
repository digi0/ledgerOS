import { inr } from "@/lib/fields";
import { STATE_CODES } from "@/lib/parser/extractors/india";
import type { InvoiceWithLines } from "@/lib/types";

/** dd/mm/yyyy from an ISO date. */
function d(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
const posLabel = (code: string) => `${code} · ${STATE_CODES[code] ?? ""}`;

/**
 * The printable GST tax-invoice sheet. Pure presentation of a persisted
 * invoice + its lines — no data access, no interactivity — so both the CA view
 * (/invoices/[id]) and the business view (/business/invoices/[id]) render the
 * exact same document. Wrap it with a PrintButton in the page.
 */
export default function InvoiceSheet({ inv }: { inv: InvoiceWithLines }) {
  const interState = inv.igst > 0;

  return (
    <div id="invoice-print" className="card mx-auto max-w-3xl p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-xl tracking-tight text-[var(--color-ink)]">TAX INVOICE</h1>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-dim)]">
            {inv.status === "cancelled" ? "CANCELLED" : "Original for Recipient"}
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--color-fg-muted)]">
          <p><span className="text-[var(--color-fg-dim)]">Invoice No</span> <span className="font-semibold text-[var(--color-ink)]">{inv.invoice_no}</span></p>
          <p><span className="text-[var(--color-fg-dim)]">Date</span> {d(inv.date)}</p>
          <p><span className="text-[var(--color-fg-dim)]">Place of Supply</span> {posLabel(inv.place_of_supply)}</p>
          {inv.reverse_charge && <p className="text-[var(--color-ink)]">Reverse charge: Yes</p>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">Supplier</p>
          <p className="mt-1 text-[14px] font-semibold text-[var(--color-ink)]">{inv.supplier_name}</p>
          {inv.supplier_address && <p className="text-[12px] text-[var(--color-fg-muted)]">{inv.supplier_address}</p>}
          <p className="text-[12px] text-[var(--color-fg-muted)]">GSTIN <span className="font-mono">{inv.supplier_gstin}</span></p>
          {inv.supplier_state && <p className="text-[12px] text-[var(--color-fg-muted)]">{STATE_CODES[inv.supplier_state] ?? inv.supplier_state}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">Bill To</p>
          <p className="mt-1 text-[14px] font-semibold text-[var(--color-ink)]">{inv.buyer_name}</p>
          {inv.buyer_address && <p className="text-[12px] text-[var(--color-fg-muted)]">{inv.buyer_address}</p>}
          <p className="text-[12px] text-[var(--color-fg-muted)]">GSTIN <span className="font-mono">{inv.buyer_gstin ?? "Unregistered (B2C)"}</span></p>
        </div>
      </div>

      <table className="mt-6 w-full">
        <thead>
          <tr className="border-y border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 px-2">HSN/SAC</th>
            <th className="py-2 px-2 text-right">Qty</th>
            <th className="py-2 px-2 text-right">Rate</th>
            <th className="py-2 px-2 text-right">Taxable</th>
            <th className="py-2 px-2 text-right">GST%</th>
            <th className="py-2 pl-2 text-right">{interState ? "IGST" : "CGST+SGST"}</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-[var(--color-border)] text-[12.5px]">
              <td className="py-2 pr-2 text-[var(--color-fg-dim)]">{l.line_no}</td>
              <td className="py-2 pr-2 text-[var(--color-ink)]">{l.description}</td>
              <td className="py-2 px-2 font-mono text-[11px] text-[var(--color-fg-muted)]">{l.hsn_sac ?? "—"}</td>
              <td className="py-2 px-2 text-right tnum">{l.qty}{l.unit ? ` ${l.unit}` : ""}</td>
              <td className="py-2 px-2 text-right tnum">{inr(l.rate) ?? "—"}</td>
              <td className="py-2 px-2 text-right tnum">{inr(l.taxable) ?? "—"}</td>
              <td className="py-2 px-2 text-right tnum">{l.gst_rate}%</td>
              <td className="py-2 pl-2 text-right tnum">{inr(interState ? l.igst : l.cgst + l.sgst) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-[12.5px]">
          <Line label="Taxable value" value={inr(inv.taxable)} />
          {interState ? (
            <Line label="IGST" value={inr(inv.igst)} />
          ) : (
            <>
              <Line label="CGST" value={inr(inv.cgst)} />
              <Line label="SGST" value={inr(inv.sgst)} />
            </>
          )}
          {inv.cess > 0 && <Line label="Cess" value={inr(inv.cess)} />}
          <div className="border-t border-[var(--color-border)] pt-1">
            <Line label="Total" value={inr(inv.total)} strong />
          </div>
        </div>
      </div>

      {inv.notes && <p className="mt-6 text-[12px] text-[var(--color-fg-muted)]">Notes: {inv.notes}</p>}
      <p className="mt-6 border-t border-[var(--color-border)] pt-3 text-center text-[11px] text-[var(--color-fg-dim)]">
        This is a computer-generated invoice.
      </p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={strong ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-fg-muted)]"}>{label}</span>
      <span className={`tnum ${strong ? "font-bold text-[var(--color-ink)]" : "text-[var(--color-fg)]"}`}>{value ?? "—"}</span>
    </div>
  );
}
