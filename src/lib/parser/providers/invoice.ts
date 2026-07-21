import type { Provider } from "../types";
import { clamp, prune } from "./util";
import {
  findAmountNear,
  findAmounts,
  findGstins,
  findHsnCodes,
  findInvoiceDate,
  findInvoiceNumber,
  splitParties,
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
    const parties = splitParties(text);
    const sellerGstin = parties.seller.gstin;
    const invoiceNo = findInvoiceNumber(text);
    const invoiceDate = findInvoiceDate(text);
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
      vendor_name: parties.seller.name,
      gstin: sellerGstin,
      // All GSTINs on the invoice. The export layer needs the counterparty too.
      all_gstins: gstins,
      buyer_name: parties.buyer.name,
      buyer_gstin: parties.buyer.gstin,
      // false ⇒ roles were guessed from text order, not read off a label.
      // The GSTR-1 bridge refuses these rather than risk filing a purchase
      // as a sale; the inbox surfaces them for a human to confirm.
      _party_roles_confident: parties.confident,
      invoice_number: invoiceNo.value,
      date: invoiceDate.value,
      // false ⇒ the label was vague or rivals disagreed. GSTR-1 keys on both,
      // so the bridge refuses these rather than file the wrong one.
      _invoice_number_confident: invoiceNo.confident,
      _date_confident: invoiceDate.confident,
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

