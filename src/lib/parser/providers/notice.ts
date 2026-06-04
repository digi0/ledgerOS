import type { Provider } from "../types";
import { capture, findAmountNear, findDate, findGstins, findPans } from "../extractors/india";
import { clamp, prune } from "./util";

/** GST or Income-Tax notice / intimation. Both map to classification "notice". */
export const noticeProvider: Provider = {
  id: "notice",
  docType: "notice",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (/\b(notice|intimation|show cause)\b/.test(t)) s += 0.3;
    if (/\basmt-?\d+|drc-?\d+|gstr-?\d+a?\b/.test(t)) s += 0.3; // GST forms
    if (/u\/s\s*143|section 143|intimation u\/s/.test(t)) s += 0.35; // IT 143(1)
    if (/u\/s\s*\d+|under section/.test(t)) s += 0.15;
    if (/scrutiny|discrepanc|mismatch|demand/.test(t)) s += 0.1;
    if (/\btax invoice\b/.test(t)) s -= 0.4;
    return clamp(s);
  },

  parse(text) {
    const t = text.toLowerCase();
    const isIncomeTax = /143\(1\)|intimation u\/s|income tax/.test(t);
    const gstins = findGstins(text);
    const pans = findPans(text);

    const noticeType =
      capture(text, /\b(ASMT-?\d+|DRC-?\d+[A-Z]?)\b/i) ??
      (isIncomeTax ? capture(text, /(intimation u\/s\s*\d+\(?\d*\)?)/i) ?? "Intimation u/s 143(1)" : null) ??
      "Notice";

    const fields = {
      domain: isIncomeTax ? "income_tax" : "gst",
      notice_type: noticeType,
      authority: isIncomeTax ? "Income Tax Department" : "GST Department",
      gstin: gstins[0] ?? null,
      pan: pans[0] ?? null,
      ay: capture(text, /\bA\.?Y\.?\s*:?\s*(\d{4}-\d{2,4})/i),
      due_date: findDate(text, /due date|reply by|respond by|within/i),
      amount_disputed: findAmountNear(text, /demand|disputed|payable|tax due/i),
      refund_determined: isIncomeTax ? findAmountNear(text, /refund/i) : null,
      subject: capture(text, /(?:subject|sub)\s*:?\s*([^\n]{6,120})/i),
    };
    return { fields: prune(fields), confidence: noticeType !== "Notice" ? 0.95 : 0.8 };
  },
};
