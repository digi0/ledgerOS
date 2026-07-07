/**
 * Canonical voucher model — the neutral, source-system-agnostic layer that
 * sits between parsed documents and every export target (Tally, Busy, GSTN
 * JSON, Zoho, CSV). See docs/integration-pipeline.md.
 *
 * A Voucher is a balanced set of double-entry ledger lines: the lowest common
 * denominator across accounting systems. Deriving one from a Document is
 * DETERMINISTIC (no LLM) — the same discipline the registers use. Serializers
 * (src/lib/export/*) turn Voucher[] into a target's format; they never look at
 * the raw document.
 */

import type { DocumentRow } from "./types";

export type VoucherKind =
  | "purchase"
  | "sales"
  | "payment"
  | "receipt"
  | "contra"
  | "journal";

/** One ledger line. Sign convention: +amount = debit, -amount = credit.
 *  A valid voucher's lines sum to zero (Σ debit = Σ credit). */
export interface VoucherLine {
  ledger: string; // canonical ledger name; mapped to a target's name at export
  amount: number;
  gst_rate?: number;
}

export interface GstBreakup {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface PartyRef {
  name: string;
  gstin?: string | null;
}

export interface Voucher {
  /** Provenance — always traces back to the parsed doc it came from. */
  source_document_id: string;
  client_id: string | null;
  client_name: string | null;
  kind: VoucherKind;
  date: string; // ISO YYYY-MM-DD internally; formatted at the serializer edge
  narration: string;
  reference: string | null; // invoice / cheque / challan number
  party: PartyRef | null;
  lines: VoucherLine[];
  gst: GstBreakup | null;
  /** Non-fatal issues a human should eyeball before posting (never hidden). */
  warnings: string[];
}

/** Canonical ledger names. Real target names are mapped from these per-adapter. */
export const LEDGER = {
  purchases: "Purchases",
  inputCgst: "Input CGST",
  inputSgst: "Input SGST",
  inputIgst: "Input IGST",
  roundOff: "Round Off",
} as const;

/** Lines whose absolute imbalance is within this (₹) get a Round Off line;
 *  a larger gap still balances but raises a warning rather than hiding it. */
const ROUNDING_TOLERANCE = 1;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Round to paise — kills float dust before the balance check. */
function paise(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sum of signed line amounts. Zero (within a paisa) means balanced. */
export function imbalance(lines: VoucherLine[]): number {
  return paise(lines.reduce((s, l) => s + l.amount, 0));
}

/**
 * Derive a canonical voucher from a parsed document. v1 handles purchase
 * invoices (classification="invoice") → a Purchase voucher. Returns null for
 * document types we don't yet turn into vouchers, so callers can skip them.
 */
export function documentToVoucher(doc: DocumentRow): Voucher | null {
  if (doc.classification === "invoice") return purchaseVoucher(doc);
  return null;
}

function purchaseVoucher(doc: DocumentRow): Voucher {
  const f = doc.extracted_fields;
  const taxable = num(f.taxable_value);
  const cgst = num(f.cgst);
  const sgst = num(f.sgst);
  const igst = num(f.igst);
  const cess = num(f.cess);
  const total = num(f.total);

  const vendor = str(f.vendor_name) ?? "Unknown Vendor";
  const gstin = str(f.gstin);
  const invoiceNo = str(f.invoice_number);
  const date = str(f.date) ?? doc.created_at.slice(0, 10);

  const warnings: string[] = [];

  // Debit side: expense + input taxes. Credit side: the vendor (party).
  // Party credit is derived from the debits so the voucher is self-consistent
  // even if the doc's own "total" is wrong — we warn if they disagree.
  const debits: VoucherLine[] = [{ ledger: LEDGER.purchases, amount: paise(taxable) }];
  if (cgst) debits.push({ ledger: LEDGER.inputCgst, amount: paise(cgst) });
  if (sgst) debits.push({ ledger: LEDGER.inputSgst, amount: paise(sgst) });
  if (igst) debits.push({ ledger: LEDGER.inputIgst, amount: paise(igst) });

  const debitTotal = paise(debits.reduce((s, l) => s + l.amount, 0) + cess);
  const lines: VoucherLine[] = [
    ...debits,
    { ledger: vendor, amount: -debitTotal }, // party credit
  ];

  // Round-off to force exact balance (also mirrors real Tally behaviour).
  const gap = imbalance(lines);
  if (gap !== 0) {
    lines.push({ ledger: LEDGER.roundOff, amount: paise(-gap) });
  }

  // Sanity vs the document's own stated total.
  if (total && Math.abs(total - debitTotal) > ROUNDING_TOLERANCE) {
    warnings.push(
      `Invoice total ₹${total} disagrees with taxable+GST ₹${debitTotal} by ₹${paise(
        total - debitTotal,
      )} — verify the parsed figures.`,
    );
  }
  if (!gstin) warnings.push("No vendor GSTIN parsed — party ledger cannot be GST-classified.");
  if (!invoiceNo) warnings.push("No invoice number parsed — voucher reference is blank.");
  if (!taxable && !total) warnings.push("No amounts parsed — voucher is empty.");

  return {
    source_document_id: doc.id,
    client_id: doc.client_id,
    client_name: doc.client?.name ?? null,
    kind: "purchase",
    date,
    narration: invoiceNo ? `Purchase — ${vendor} — ${invoiceNo}` : `Purchase — ${vendor}`,
    reference: invoiceNo,
    party: { name: vendor, gstin },
    lines,
    gst: taxable || cgst || sgst || igst ? { taxable, cgst, sgst, igst, cess } : null,
    warnings,
  };
}

/** Derive vouchers for a batch of documents, dropping the ones with no mapping. */
export function documentsToVouchers(docs: DocumentRow[]): Voucher[] {
  return docs.map(documentToVoucher).filter((v): v is Voucher => v !== null);
}
