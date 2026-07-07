import type { Provider } from "../types";
import {
  capture,
  findAmountNear,
  findAmounts,
  findDate,
  findGstins,
  findHsnCodes,
  stateFromGstin,
} from "../extractors/india";

/** GST tax invoice. */
export const invoiceProvider: Provider = {
  id: "gst-invoice",
  docType: "invoice",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (/\btax invoice\b/.test(t)) s += 0.45;
    else if (/\binvoice\b/.test(t)) s += 0.2;
    if (/invoice\s*(?:no|number|#)/.test(t)) s += 0.2;
    if (findGstins(text).length > 0) s += 0.2;
    if (/\b(cgst|sgst|igst)\b/.test(t)) s += 0.2;
    if (/\bhsn\b|\bsac\b/.test(t)) s += 0.1;
    if (/\b(bank statement|form no\.?\s*16|statement of account)\b/.test(t)) s -= 0.5;
    if (/\bform\s*gstr\s*-?\s*\d/.test(t)) s -= 0.5; // filed GST return, not an invoice
    return clamp(s);
  },

  parse(text) {
    const gstins = findGstins(text);
    const sellerGstin = gstins[0] ?? null;
    const cgst = findAmountNear(text, /cgst/i);
    const sgst = findAmountNear(text, /sgst/i);
    const igst = findAmountNear(text, /igst/i);
    const taxable =
      findAmountNear(text, /taxable\s*(?:value|amount)/i) ??
      findAmountNear(text, /total\s*taxable/i);
    const total =
      findAmountNear(text, /(?:grand total|amount payable|invoice total|total amount)/i) ??
      findAmounts(text)[0] ??
      null;

    const fields: Record<string, unknown> = {
      vendor_name: vendorName(text),
      gstin: sellerGstin,
      // All GSTINs on the invoice, seller first. The export layer needs the
      // counterparty (recipient) too — it can't tell it from the seller alone.
      all_gstins: gstins,
      buyer_name: buyerName(text),
      invoice_number: capture(text, /invoice\s*(?:no|number|#)\.?\s*:?\s*([A-Za-z0-9/\-]+)/i),
      date: findDate(text, /invoice\s*date|dated|date/i),
      taxable_value: taxable,
      cgst,
      sgst,
      igst,
      total,
      hsn_codes: findHsnCodes(text),
      place_of_supply: sellerGstin ? stateFromGstin(sellerGstin) : null,
    };
    // confidence rises when the money actually adds up
    const confidence = total && taxable ? 0.97 : total ? 0.9 : 0.75;
    return { fields: prune(fields), confidence };
  },
};

/** Seller name: the text before the first invoice marker. Works whether the
 *  PDF preserved line breaks or flattened everything onto one line. */
function vendorName(text: string): string | null {
  const head = text.split(/tax invoice|invoice\s*(?:no|date|#)|gstin/i)[0]?.trim() ?? "";
  const candidate = (head.split("\n").map((l) => l.trim()).find((l) => l.length > 2) ?? head)
    .replace(/\s+/g, " ")
    .trim();
  if (!candidate || candidate.length > 80) return null;
  return candidate;
}
/** Buyer/recipient name from a "Bill To" / "Buyer" / "Consignee" block, if the
 *  invoice has one. Best-effort — the export bridge keys on GSTIN, not name. */
function buyerName(text: string): string | null {
  const m = /(?:bill\s*to|buyer|consignee|billed\s*to)\s*:?\s*\n?\s*([^\n]{2,80})/i.exec(text);
  const candidate = m?.[1]?.replace(/\s+/g, " ").trim();
  return candidate && candidate.length > 2 ? candidate : null;
}
function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function prune(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
  );
}
