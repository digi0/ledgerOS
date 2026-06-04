import type { Provider } from "../types";
import { findAmountNear, findAmounts, findDate } from "../extractors/india";
import { clamp, firstLine, prune } from "./util";

/** Simple payment receipt — low priority, loses to invoice when both match. */
export const receiptProvider: Provider = {
  id: "receipt",
  docType: "receipt",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (/\breceipt\b/.test(t)) s += 0.35;
    if (/received with thanks|payment received|paid/.test(t)) s += 0.2;
    if (/\btax invoice\b/.test(t)) s -= 0.3; // invoices win
    if (/\b(cgst|sgst|igst)\b/.test(t)) s -= 0.15;
    return clamp(s);
  },

  parse(text) {
    const fields = {
      vendor_name: firstLine(text, /receipt/i),
      date: findDate(text, /date|dated/i),
      total: findAmountNear(text, /amount|total|received/i) ?? findAmounts(text)[0] ?? null,
      category: "receipt",
    };
    return { fields: prune(fields), confidence: 0.82 };
  },
};
