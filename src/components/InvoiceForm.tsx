"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileText } from "lucide-react";
import { costInvoice, type LineInput } from "@/lib/invoice";
import { stateCode, financialYear } from "@/lib/gst";
import { STATE_CODES } from "@/lib/parser/extractors/india";
import { createInvoice } from "@/lib/invoice-actions";
import { inr } from "@/lib/fields";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const GST_RATES = [0, 5, 12, 18, 28];

type Row = { description: string; hsn_sac: string; qty: string; unit: string; rate: string; gst_rate: number };
const emptyRow = (): Row => ({ description: "", hsn_sac: "", qty: "1", unit: "", rate: "", gst_rate: 18 });

/**
 * Raise Invoice — the client is the supplier. Totals preview uses the SAME
 * costInvoice() the server action persists, so what the CA sees is what gets
 * filed. On save the invoice is issued and the CA lands on its printable view.
 */
export default function InvoiceForm({
  client,
}: {
  client: { id: string; name: string; gstin: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [posOverride, setPosOverride] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const supplierState = stateCode(client.gstin) ?? "";
  const buyerGstinValid = GSTIN_RE.test(buyerGstin.trim().toUpperCase());
  const pos = buyerGstinValid ? buyerGstin.trim().toUpperCase().slice(0, 2) : posOverride || supplierState;
  const interState = pos !== supplierState;

  const lines: LineInput[] = rows
    .filter((r) => r.description.trim())
    .map((r) => ({
      description: r.description,
      hsn_sac: r.hsn_sac || null,
      qty: Number(r.qty) || 0,
      unit: r.unit || null,
      rate: Number(r.rate) || 0,
      gst_rate: r.gst_rate,
    }));

  const costed = useMemo(
    () => costInvoice({ supplierState: supplierState || "24", placeOfSupply: pos || "24", lines }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(lines), supplierState, pos],
  );

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function submit() {
    setError(null);
    if (!client.gstin) { setError(`${client.name} has no GSTIN — add one before raising a GST invoice.`); return; }
    if (!buyerName.trim()) { setError("Buyer name is required."); return; }
    if (lines.length === 0) { setError("Add at least one line item with a description."); return; }
    startTransition(async () => {
      const res = await createInvoice({
        clientId: client.id, date, invoiceNo: invoiceNo.trim() || undefined,
        buyerName, buyerGstin: buyerGstin.trim() || undefined, buyerAddress: buyerAddress.trim() || undefined,
        placeOfSupply: pos, reverseCharge, notes: notes.trim() || undefined, lines,
      });
      if (res.ok) router.push(`/invoices/${res.id}`);
      else setError(res.error);
    });
  }

  const field = "h-10 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13.5px] outline-none focus:border-[var(--color-border-strong)]";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]";

  return (
    <div className="space-y-5">
      {/* Supplier context */}
      <div className="card p-4">
        <p className={label}>Supplier (you, for {client.name})</p>
        <p className="mt-1 text-[14px] font-medium text-[var(--color-ink)]">{client.name}</p>
        <p className="text-[12px] text-[var(--color-fg-muted)]">
          GSTIN <span className="font-mono">{client.gstin ?? "— not set —"}</span>
          {supplierState && ` · ${STATE_CODES[supplierState] ?? supplierState}`}
        </p>
      </div>

      {/* Invoice + buyer */}
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label className={label}>Invoice date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1`} />
          <p className="mt-1 text-[11px] text-[var(--color-fg-dim)]">FY {financialYear(date)}</p>
        </div>
        <div>
          <label className={label}>Invoice number</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="auto (INV/FY/NNN)" className={`${field} mt-1`} />
        </div>
        <div>
          <label className={label}>Buyer name *</label>
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Recipient / customer" className={`${field} mt-1`} />
        </div>
        <div>
          <label className={label}>Buyer GSTIN <span className="normal-case text-[var(--color-fg-dim)]">(blank = B2C)</span></label>
          <input value={buyerGstin} onChange={(e) => setBuyerGstin(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" className={`${field} mt-1 font-mono`} />
          {buyerGstin && !buyerGstinValid && <p className="mt-1 text-[11px] text-red-500">Not a valid GSTIN yet.</p>}
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Buyer address</label>
          <input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} className={`${field} mt-1`} />
        </div>
        <div>
          <label className={label}>Place of supply</label>
          {buyerGstinValid ? (
            <input disabled value={`${pos} · ${STATE_CODES[pos] ?? ""}`} className={`${field} mt-1 opacity-70`} />
          ) : (
            <select value={posOverride || supplierState} onChange={(e) => setPosOverride(e.target.value)} className={`${field} mt-1`}>
              {Object.entries(STATE_CODES).map(([code, name]) => (
                <option key={code} value={code}>{code} · {name}</option>
              ))}
            </select>
          )}
          <p className="mt-1 text-[11px] text-[var(--color-fg-dim)]">{interState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}</p>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-[var(--color-fg)]">
          <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} />
          Reverse charge
        </label>
      </div>

      {/* Line items */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Line items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 w-24">HSN/SAC</th>
                <th className="px-3 py-2 w-16 text-right">Qty</th>
                <th className="px-3 py-2 w-16">Unit</th>
                <th className="px-3 py-2 w-28 text-right">Rate</th>
                <th className="px-3 py-2 w-20">GST%</th>
                <th className="px-3 py-2 w-28 text-right">Taxable</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const taxable = (Number(r.qty) || 0) * (Number(r.rate) || 0);
                const cell = "h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] outline-none focus:border-[var(--color-border-strong)]";
                return (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2"><input value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder="Item / service" className={cell} /></td>
                    <td className="px-3 py-2"><input value={r.hsn_sac} onChange={(e) => setRow(i, { hsn_sac: e.target.value })} className={`${cell} font-mono`} /></td>
                    <td className="px-3 py-2"><input value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} inputMode="decimal" className={`${cell} text-right`} /></td>
                    <td className="px-3 py-2"><input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} placeholder="NOS" className={cell} /></td>
                    <td className="px-3 py-2"><input value={r.rate} onChange={(e) => setRow(i, { rate: e.target.value })} inputMode="decimal" className={`${cell} text-right`} /></td>
                    <td className="px-3 py-2">
                      <select value={r.gst_rate} onChange={(e) => setRow(i, { gst_rate: Number(e.target.value) })} className={cell}>
                        {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] tnum text-[var(--color-fg)]">{inr(taxable) ?? "—"}</td>
                    <td className="px-3 py-2">
                      {rows.length > 1 && (
                        <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove line" className="text-[var(--color-fg-dim)] hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-2.5">
          <button onClick={() => setRows((rs) => [...rs, emptyRow()])} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand)] hover:underline">
            <Plus className="h-4 w-4" /> Add line
          </button>
        </div>
      </div>

      {/* Totals + submit */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label className={label}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-border-strong)]" />
        </div>
        <div className="card w-full p-4 sm:max-w-xs">
          <Row2 label="Taxable" value={inr(costed.taxable)} />
          {interState ? (
            <Row2 label="IGST" value={inr(costed.igst)} />
          ) : (
            <>
              <Row2 label="CGST" value={inr(costed.cgst)} />
              <Row2 label="SGST" value={inr(costed.sgst)} />
            </>
          )}
          {costed.cess > 0 && <Row2 label="Cess" value={inr(costed.cess)} />}
          <div className="mt-2 border-t border-[var(--color-border)] pt-2">
            <Row2 label="Total" value={inr(costed.total)} strong />
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={() => router.back()} className="rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]">Cancel</button>
        <button onClick={submit} disabled={pending} className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-40">
          <FileText className="h-4 w-4" /> {pending ? "Issuing…" : "Issue invoice"}
        </button>
      </div>
    </div>
  );
}

function Row2({ label, value, strong }: { label: string; value: string | null; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[12px] ${strong ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-fg-muted)]"}`}>{label}</span>
      <span className={`tnum ${strong ? "text-[15px] font-bold text-[var(--color-ink)]" : "text-[13px] text-[var(--color-fg)]"}`}>{value ?? "—"}</span>
    </div>
  );
}
