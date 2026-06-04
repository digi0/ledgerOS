/**
 * India accounting/tax knowledge base — the deterministic primitives every
 * provider builds on. GSTIN/PAN, INR amounts (Indian + western grouping),
 * Indian date formats (day-first), GST state codes, TDS sections, HSN/SAC.
 *
 * No network, no LLM. Pure string → structured value.
 */

// ---- GSTIN / PAN --------------------------------------------------------
// PAN:   AAAAA9999A
// GSTIN: 99 + PAN(10) + entity(1) + 'Z' + checksum(1)  → 15 chars
export const PAN_RE = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
export const GSTIN_RE = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g;

export function findGstins(text: string): string[] {
  return unique((text.toUpperCase().match(GSTIN_RE) ?? []) as string[]);
}

/** PANs that are NOT the PAN-substring of a GSTIN already found. */
export function findPans(text: string): string[] {
  const up = text.toUpperCase();
  const gstinPans = new Set(findGstins(up).map((g) => g.slice(2, 12)));
  return unique((up.match(PAN_RE) ?? []).filter((p) => !gstinPans.has(p)) as string[]);
}

export function panFromGstin(gstin: string): string | null {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/.test(gstin) ? gstin.slice(2, 12) : null;
}

// ---- GST state codes (first 2 digits of a GSTIN) ------------------------
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh (Old)", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

export function stateFromGstin(gstin: string): string | null {
  return STATE_CODES[gstin.slice(0, 2)] ?? null;
}

// ---- TDS sections (Income Tax Act) --------------------------------------
export const TDS_SECTIONS: Record<string, string> = {
  "192": "Salary", "192A": "PF withdrawal", "193": "Interest on securities",
  "194": "Dividend", "194A": "Interest (other than securities)",
  "194B": "Winnings", "194C": "Contractor / sub-contractor", "194D": "Insurance commission",
  "194DA": "Life insurance payout", "194H": "Commission or brokerage", "194I": "Rent",
  "194IA": "Transfer of immovable property", "194IB": "Rent by individual/HUF",
  "194J": "Professional / technical fees", "194K": "Income from units",
  "194LA": "Compensation on acquisition", "194M": "Payment by individual/HUF",
  "194N": "Cash withdrawal", "194O": "E-commerce", "194Q": "Purchase of goods",
  "195": "Payment to non-resident", "206C": "TCS",
};

export function findTdsSection(text: string): string | null {
  // Match "194J", "section 194-J", "u/s 194C", etc.
  const m = text.toUpperCase().match(/\b(?:U\/S\s*|SECTION\s*)?(19[2-9][A-Z]{0,2}|206C|195)\b/);
  if (!m) return null;
  const code = m[1].replace(/-/g, "");
  return TDS_SECTIONS[code] ? code : null;
}

// ---- INR amounts --------------------------------------------------------
// Handles ₹ / Rs / Rs. / INR prefixes and both 1,23,456.78 (Indian) and
// 123,456.78 (western) grouping. Returns a number (rupees).
export function parseInr(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹]|rs\.?|inr/gi, "").trim();
  const m = cleaned.match(/-?\d[\d,]*(?:\.\d{1,2})?/);
  if (!m) return null;
  const n = Number(m[0].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** All rupee-looking amounts in the text, largest first. */
export function findAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = parseInr(m[1] ?? m[2] ?? "");
    if (v != null && v > 0) out.push(v);
  }
  return out.sort((a, b) => b - a);
}

/**
 * The rupee amount appearing just after a label like /grand total|cgst/.
 * Skips an intervening rate ("CGST 9%: 11,250") and prefers a real money
 * shape (comma-grouped or .NN-decimal) over a bare small integer.
 * The label is wrapped in (?:…) so alternations inside it don't detach the
 * amount capture group.
 */
export function findAmountNear(text: string, label: RegExp): number | null {
  const amount = String.raw`(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2}|\d{4,})`;
  const re = new RegExp(
    `(?:${label.source})` +
      String.raw`(?:\s*\d{1,2}(?:\.\d+)?\s*%)?[^\d₹\n]{0,20}(?:₹|rs\.?|inr)?\s*` +
      amount,
    "i",
  );
  const m = text.match(re);
  return m && m[1] ? parseInr(m[1]) : null;
}

// ---- Dates (Indian day-first) -------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/** First date found, normalised to ISO yyyy-mm-dd. Day-first when ambiguous. */
export function findDate(text: string, label?: RegExp): string | null {
  const scope = label ? sliceAfter(text, label, 60) : text;
  if (!scope) return null;

  // 12/04/2026, 12-04-2026, 12.04.2026
  let m = scope.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/);
  if (m) {
    const d = +m[1], mo = +m[2], y = normYear(+m[3]);
    if (d <= 31 && mo <= 12) return iso(y, mo, d);
  }
  // 12 Apr 2026 / 12 April 2026
  m = scope.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) {
    return iso(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  }
  // Apr 12, 2026
  m = scope.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) {
    return iso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  }
  return null;
}

// ---- HSN / SAC ----------------------------------------------------------
export function findHsnCodes(text: string): string[] {
  const out: string[] = [];
  const re = /\b(?:HSN|SAC)\s*(?:code)?\s*:?\s*(\d{4,8})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return unique(out);
}

// ---- helpers ------------------------------------------------------------
function unique<T>(a: T[]): T[] {
  return [...new Set(a)];
}
function normYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function sliceAfter(text: string, label: RegExp, len: number): string | null {
  const m = text.match(label);
  if (m?.index == null) return null;
  return text.slice(m.index, m.index + len + m[0].length);
}

/** First capture group of a pattern, trimmed, or null. */
export function capture(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() || null;
}
