/**
 * Invoice arithmetic — turns raw line inputs (what the CA types) into a fully
 * costed invoice: per-line taxable + GST split, then invoice totals. Pure and
 * deterministic; the create action (server) persists the result, and the same
 * numbers feed the outward register + GSTR-1 with no re-extraction.
 *
 * Because a generated invoice is structured at birth, turning it into a
 * GSTR-1 sales line is a direct projection — no parser, no bridge heuristics.
 */

import { round2, splitGst } from "./gst";
import type { Gstr1SalesLine } from "./export/gstr1";
import type { Invoice, InvoiceLine, InvoiceWithLines } from "./types";

/** One line as the CA enters it, before we cost it. */
export interface LineInput {
  description: string;
  hsn_sac?: string | null;
  qty: number;
  unit?: string | null;
  rate: number; // price per unit, pre-tax
  gst_rate: number; // %
  cess?: number;
}

/** Everything needed to cost an invoice, independent of persistence. */
export interface InvoiceInput {
  supplierState: string; // 2-digit GST state code of the client (supplier)
  placeOfSupply: string; // 2-digit GST state code
  lines: LineInput[];
}

export interface CostedLine extends LineInput {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

export interface CostedInvoice {
  lines: CostedLine[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
}

/**
 * Cost every line and total the invoice. Taxable = qty × rate; GST split by
 * supplier state vs place of supply. All money rounded to paise.
 */
export function costInvoice(input: InvoiceInput): CostedInvoice {
  const lines: CostedLine[] = input.lines.map((l) => {
    const taxable = round2(l.qty * l.rate);
    const { cgst, sgst, igst } = splitGst(taxable, l.gst_rate, input.supplierState, input.placeOfSupply);
    const cess = round2(l.cess ?? 0);
    return { ...l, taxable, cgst, sgst, igst, cess, total: round2(taxable + cgst + sgst + igst + cess) };
  });

  const sum = (pick: (l: CostedLine) => number) => round2(lines.reduce((s, l) => s + pick(l), 0));
  return {
    lines,
    taxable: sum((l) => l.taxable),
    cgst: sum((l) => l.cgst),
    sgst: sum((l) => l.sgst),
    igst: sum((l) => l.igst),
    cess: sum((l) => l.cess),
    total: sum((l) => l.total),
  };
}

/**
 * Project a persisted invoice into GSTR-1 sales lines — one per distinct GST
 * rate on the invoice (a b2b invoice can carry several rate items). No parsing:
 * every field is already exact. B2C when the buyer has no GSTIN.
 */
export function invoiceToGstr1Lines(inv: InvoiceWithLines): Gstr1SalesLine[] {
  // Group lines by rate so each rate becomes one GSTR-1 item for this invoice.
  const byRate = new Map<number, InvoiceLine[]>();
  for (const l of inv.lines) (byRate.get(l.gst_rate) ?? byRate.set(l.gst_rate, []).get(l.gst_rate)!).push(l);

  const rates = [...byRate.keys()];
  return rates.map((rate) => {
    const group = byRate.get(rate)!;
    const taxable = round2(group.reduce((s, l) => s + l.taxable, 0));
    const cess = round2(group.reduce((s, l) => s + l.cess, 0));
    // Invoice value is the whole invoice's total, but per-rate lines carry only
    // their share; GSTN wants the full invoice value on each item's parent.
    return {
      recipientGstin: inv.buyer_gstin,
      recipientName: inv.buyer_name,
      invoiceNo: inv.invoice_no,
      invoiceDate: inv.date,
      invoiceValue: round2(inv.total),
      pos: inv.place_of_supply,
      rate,
      taxableValue: taxable,
      cess: cess || undefined,
      reverseCharge: inv.reverse_charge,
      invoiceType: "R",
      hsn: group[0].hsn_sac ?? undefined,
      uqc: group[0].unit ?? undefined,
      quantity: round2(group.reduce((s, l) => s + l.qty, 0)),
    };
  });
}

/** Convenience: project a batch of invoices to GSTR-1 lines. */
export function invoicesToGstr1Lines(invoices: InvoiceWithLines[]): Gstr1SalesLine[] {
  return invoices.flatMap(invoiceToGstr1Lines);
}

/** Suggest the next serial for a client's financial year (max existing + 1). */
export function nextSeq(existing: Pick<Invoice, "fy" | "seq">[], fy: string): number {
  const inFy = existing.filter((i) => i.fy === fy);
  return inFy.length ? Math.max(...inFy.map((i) => i.seq)) + 1 : 1;
}
