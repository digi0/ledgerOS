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

// ---- Invoice parties (who is the seller, who is the buyer) --------------
/**
 * Role assignment must come from the document's own labels, never from text
 * order: pdf.js emits text in DRAW order, not visual order, so a two-column
 * header can put the "Bill To" block ahead of the seller's letterhead. Taking
 * gstins[0] as the seller silently swaps the parties on those layouts, which
 * flips a sale into a purchase in the GSTR-1 bridge.
 */
const BUYER_MARKER =
  String.raw`bill(?:ed)?\s*to|buyer|consignee|ship(?:ped)?\s*to|recipient|customer|party\s*(?:name|details)`;
const SELLER_MARKER = String.raw`sold\s*by|seller|supplier|service\s*provider|from`;

/** How far after a "Bill To" label its own GSTIN can sit. Blocks are compact;
 *  a wider window starts swallowing the seller's GSTIN further down the page. */
const BLOCK_SPAN = 250;

export interface InvoiceParties {
  seller: { gstin: string | null; name: string | null };
  buyer: { gstin: string | null; name: string | null };
  /**
   * false ⇒ the document carried no usable role labels and the split fell back
   * to text order. Callers that file a return or post a ledger entry MUST
   * refuse rather than trust an unconfident split.
   */
  confident: boolean;
}

/** Split an invoice's parties by label, not by position. */
export function splitParties(text: string): InvoiceParties {
  const up = text.toUpperCase();
  const gstins = [...up.matchAll(new RegExp(GSTIN_RE.source, "g"))].map((m) => ({
    gstin: m[0],
    index: m.index ?? 0,
  }));
  const buyerMarks = marks(text, BUYER_MARKER);
  const sellerMarks = marks(text, SELLER_MARKER);

  // Buyer = the first GSTIN sitting inside a "Bill To"-style block. A tax
  // invoice must carry the supplier's GSTIN; the recipient's is optional
  // (B2C), so a lone GSTIN is the seller's — no guesswork needed.
  const buyerHit =
    gstins.length > 1
      ? gstins.find((g) => buyerMarks.some((mk) => g.index >= mk.end && g.index - mk.end < BLOCK_SPAN))
      : undefined;

  // The region the buyer's details occupy — excluded when hunting for the
  // seller's name, so a leading "Bill To" block can't supply it.
  const buyerBlock: Span | null = buyerMarks[0]
    ? [buyerMarks[0].index, buyerHit ? buyerHit.index + 15 : buyerMarks[0].end + 120]
    : null;

  const seller = {
    gstin: buyerHit
      ? gstins.find((g) => g.gstin !== buyerHit.gstin)?.gstin ?? null
      : gstins[0]?.gstin ?? null,
    name: sellerName(text, sellerMarks[0], buyerBlock),
  };
  const buyer = {
    gstin: buyerHit?.gstin ?? (gstins.length > 1 && !buyerHit ? gstins[1].gstin : null),
    name: nameAfter(text, buyerMarks[0]),
  };

  // Confident when a label tied a GSTIN to a role, or when there is only one
  // GSTIN (which the invoice rules say is the supplier's). Otherwise we fell
  // back to text order — say so; that is the case that files a wrong return.
  return { seller, buyer, confident: gstins.length <= 1 || Boolean(buyerHit) };
}

type Span = [start: number, end: number];

type Mark = { index: number; end: number };

function marks(text: string, source: string): Mark[] {
  return [...text.matchAll(new RegExp(source, "gi"))]
    .filter((m) => m.index != null)
    .map((m) => ({ index: m.index!, end: m.index! + m[0].length }));
}

/** Seller name: the block after a "Sold By" label, else the letterhead — with
 *  the buyer's block cut out so a leading "Bill To" can't supply it. */
function sellerName(text: string, sellerMark: Mark | undefined, buyerBlock: Span | null): string | null {
  if (sellerMark) return nameAfter(text, sellerMark);
  const outside = buyerBlock ? text.slice(0, buyerBlock[0]) + "\n" + text.slice(buyerBlock[1]) : text;
  return firstNameLine(outside);
}

function nameAfter(text: string, mark: Mark | undefined): string | null {
  return mark ? firstNameLine(text.slice(mark.end, mark.end + 160)) : null;
}

/** First line that reads like a party name — not a GSTIN, PAN, date, amount,
 *  or a bare field label. */
function firstNameLine(chunk: string): string | null {
  for (const raw of chunk.split("\n")) {
    const line = raw.replace(/^[\s:\-,]+/, "").replace(/\s+/g, " ").trim();
    if (line.length < 3 || line.length > 80) continue;
    if (new RegExp(`^(?:${GSTIN_RE.source}|${PAN_RE.source})$`, "i").test(line)) continue;
    if (/^(?:gstin|pan|state|address|code|phone|email|tel)\b/i.test(line)) continue;
    if (!/[A-Za-z]{3}/.test(line)) continue;
    return line;
  }
  return null;
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
  // 2026-04-12 (ISO — some ERPs emit this even on Indian invoices)
  m = scope.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m && +m[2] <= 12 && +m[3] <= 31) return iso(+m[1], +m[2], +m[3]);
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

// ---- Labelled fields (invoice number, invoice date) ---------------------
/**
 * Taking the first label-ish match anywhere in the text is how "Due Date" and
 * "E-Way Bill Date" beat the real invoice date, and how "Original Invoice No"
 * beats a credit note's own number. So: anchor every label on word boundaries,
 * rank labels by specificity, and let the highest rank win wherever it sits.
 */
export interface Labelled<T> {
  value: T | null;
  /** false ⇒ only a vague label matched, or equally-specific labels disagreed. */
  confident: boolean;
}

type LabelRule = { re: string; rank: number };

/** Words that, immediately before a label, mean it belongs to another field. */
const NOT_INVOICE_DATE =
  String.raw`due|delivery|deliver|e-?way|ack(?:nowledgement)?|p\.?o\.?|purchase\s*order|order|payment|challan|receipt|valid|expiry|supply`;
const NOT_INVOICE_NUMBER =
  String.raw`original|ref(?:erence)?|previous|against|revised|p\.?o\.?|purchase\s*order|order|challan|e-?way|delivery|transport|vehicle|lr`;

// Label internals use [ \t]* rather than \s* on purpose: \s* spans newlines,
// which glues a "TAX INVOICE" heading to the next line's "Date:" and scores it
// as a rank-3 "Invoice Date". A real two-word label never straddles a line.
const DATE_LABELS: LabelRule[] = [
  { re: String.raw`invoice[ \t]*date`, rank: 3 },
  { re: String.raw`bill[ \t]*date`, rank: 3 },
  { re: String.raw`\bdated\b`, rank: 2 },
  { re: String.raw`\bdate\b`, rank: 1 },
];

const NUMBER_LABELS: LabelRule[] = [
  { re: String.raw`tax[ \t]*invoice[ \t]*(?:no|number|#)`, rank: 4 },
  { re: String.raw`invoice[ \t]*(?:no|number|#)`, rank: 3 },
  { re: String.raw`bill[ \t]*(?:no|number|#)`, rank: 2 },
  { re: String.raw`doc(?:ument)?[ \t]*(?:no|number|#)`, rank: 1 },
];

/** Value shape for an invoice number — lazy, and stops at the next label so a
 *  flattened "No.:G/31Date:12/04" doesn't yield "G/31Date". */
const NUMBER_VALUE = String.raw`\.?\s*:?\s*([A-Za-z0-9][A-Za-z0-9/\-]*?)(?=\s|$|[,;|]|date|dated|dt\b|gstin|hsn|qty)`;

function labelHits(
  text: string,
  labels: LabelRule[],
  disqualify: string,
): { rank: number; index: number; end: number }[] {
  const out: { rank: number; index: number; end: number }[] = [];
  for (const { re, rank } of labels) {
    // (?<!…) rejects "Due Date", "Original Invoice No", etc. The trailing
    // [\s:\-]* lets the disqualifier sit a space or punctuation away.
    const rx = new RegExp(String.raw`(?<!(?:${disqualify})[\s:\-]{0,3})(?:${re})`, "gi");
    for (const m of text.matchAll(rx)) {
      if (m.index != null) out.push({ rank, index: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

/** Resolve one labelled field: best-ranked label wins; ties that disagree are
 *  reported as unconfident rather than silently picking the first. */
function resolve<T>(
  hits: { rank: number; index: number; end: number }[],
  read: (at: { index: number; end: number }) => T | null,
): Labelled<T> {
  const scored = hits
    .map((h) => ({ ...h, value: read(h) }))
    .filter((h): h is typeof h & { value: T } => h.value != null);
  if (scored.length === 0) return { value: null, confident: false };

  const top = Math.max(...scored.map((h) => h.rank));
  const best = scored.filter((h) => h.rank === top).sort((a, b) => a.index - b.index);
  const agree = best.every((h) => h.value === best[0].value);
  // A vague label is fine when it is the only candidate; it is not fine when
  // rivals of the same rank point somewhere else.
  return { value: best[0].value, confident: agree && (top >= 2 || best.length === 1) };
}

export function findInvoiceDate(text: string): Labelled<string> {
  return resolve(labelHits(text, DATE_LABELS, NOT_INVOICE_DATE), ({ end }) =>
    findDate(text.slice(end, end + 60)),
  );
}

export function findInvoiceNumber(text: string): Labelled<string> {
  return resolve(labelHits(text, NUMBER_LABELS, NOT_INVOICE_NUMBER), ({ end }) => {
    const m = new RegExp(`^${NUMBER_VALUE}`, "i").exec(text.slice(end, end + 40));
    const v = m?.[1]?.trim();
    // A bare date is never an invoice number — that's the two fields colliding.
    if (!v || /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{2,4}$/.test(v)) return null;
    return v;
  });
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
