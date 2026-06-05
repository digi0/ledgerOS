import type { Provider } from "../types";
import { capture, findDate, findGstins, stateFromGstin } from "../extractors/india";
import { clamp, prune } from "./util";

/**
 * GST return filings — GSTR-3B (monthly summary), GSTR-1 (outward supplies),
 * GSTR-9 (annual), etc. These are *filed returns*, not notices: the portal
 * PDF opens with "Form GSTR-N [See rule …]" and carries an ARN. Built against
 * a real GSTR-3B portal download (the first real document LedgerOS ingested,
 * which the invoice provider had claimed at 0.9 confidence).
 */
export const gstReturnProvider: Provider = {
  id: "gst-return",
  docType: "gst_return",

  match(text) {
    const t = text.toLowerCase();
    let s = 0;
    if (/\bform\s*gstr\s*-?\s*\d/.test(t)) s += 0.6;
    if (/see rule \d+\(\d+\)/.test(t)) s += 0.15; // portal rule citation, e.g. 61(5)
    if (/\barn\b/.test(t)) s += 0.1; // filed returns carry an acknowledgement no.
    if (/eligible itc|outward supplies|payment of tax/.test(t)) s += 0.15;
    if (/\btax invoice\b/.test(t)) s -= 0.4;
    return clamp(s);
  },

  parse(text) {
    const form = capture(text, /form\s*gstr\s*-?\s*(\d+[AB]?)/i);
    const gstin = findGstins(text)[0] ?? null;
    const arn = capture(text, /\barn\b\s*:?\s*([A-Z]{2}[0-9A-Z]{10,16})/i);

    // 3.1(a) — outward taxable supplies row: taxable value, IGST, CGST, SGST, cess
    const outward = numbersAfter(text, /outward taxable supplies\s*\(other than zero/i, 5);
    const [taxableTurnover, igst, cgst, sgst, cess] = outward ?? [];
    const totalTax =
      outward && outward.length >= 4 ? round2((igst ?? 0) + (cgst ?? 0) + (sgst ?? 0) + (cess ?? 0)) : null;

    // 4(C) — net ITC available row: IGST, CGST, SGST, cess
    const itc = numbersAfter(text, /net itc available\s*\(a\s*-\s*b\)/i, 4);
    const netItc = itc ? round2(itc.reduce((a, b) => a + b, 0)) : null;

    const fields = {
      form: form ? `GSTR-${form.toUpperCase()}` : null,
      gstin,
      legal_name: capture(text, /legal name of the registered person\s*:?\s*(.+?)\s*(?:2\(b\)|trade name)/i),
      trade_name: capture(text, /trade name,?\s*if any\s*:?\s*(.+?)\s*(?:2\(c\)|\barn\b)/i),
      period: filingPeriod(text),
      arn,
      date: findDate(text, /date of arn|date of filing/i),
      taxable_turnover: taxableTurnover ?? null,
      igst: igst ?? null,
      cgst: cgst ?? null,
      sgst: sgst ?? null,
      total_tax: totalTax,
      net_itc: netItc,
      status: /\bFILED\b/.test(text) ? "filed" : null,
      state: gstin ? stateFromGstin(gstin) : null,
    };
    void cess; // row position is needed, value rarely interesting on its own
    const confidence = form && gstin && arn ? 0.97 : form ? 0.85 : 0.7;
    return { fields: prune(fields), confidence };
  },
};

/** The first N plain numbers following a label — GSTR table rows are
 *  uncomma'd decimals ("72412908.50 2959908.48 …"), so parseInr's comma
 *  heuristics aren't needed here. */
function numbersAfter(text: string, label: RegExp, n: number): number[] | null {
  const m = text.match(label);
  if (!m || m.index == null) return null;
  const scope = text.slice(m.index + m[0].length, m.index + m[0].length + 250);
  const nums = (scope.match(/-?\d+(?:\.\d+)?/g) ?? []).slice(0, n).map(Number);
  return nums.length === n ? nums : nums.length > 0 ? nums : null;
}

/** "Year 2026-27 Period April" → "April 2026" (FY runs Apr–Mar, so
 *  Jan/Feb/Mar fall in the second calendar year of the FY). */
function filingPeriod(text: string): string | null {
  const period = capture(text, /period\s+([A-Za-z]+)/i);
  const fy = capture(text, /year\s+(\d{4})\s*-\s*\d{2,4}/i);
  if (!period) return null;
  if (!fy) return period;
  const firstYear = Number(fy);
  const month = period.toLowerCase().slice(0, 3);
  const inSecondHalf = ["jan", "feb", "mar"].includes(month);
  return `${period} ${inSecondHalf ? firstYear + 1 : firstYear}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
