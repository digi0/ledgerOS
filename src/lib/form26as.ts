/**
 * Form 26AS parser + reconciliation engine.
 *
 * 26AS is the Annual Tax Statement issued by TRACES.  It lists every TDS
 * deduction against the assessee's PAN for the financial year.  CAs upload it
 * to cross-check their TDS register (Form 16/16A docs) and catch:
 *   - Missing entries (deductor filed 26AS but CA has no Form 16A) → claim credit
 *   - Register-only entries (CA has Form 16A but not in 26AS)      → chase deductor
 *   - Amount mismatches                                              → verify & correct
 */

import { TDS_SECTIONS } from "./parser/extractors/india";

// ---- Types ------------------------------------------------------------------

export type ReconStatus26as =
  | "matched"          // section + quarter + TDS amount agree
  | "amount_mismatch"  // section + quarter match, TDS amount differs > ₹2
  | "register_only"    // CA has Form 16A, deductor not yet in 26AS
  | "26as_only";       // In 26AS but no matching Form 16A → unclaimed credit

export interface Form26asEntry {
  id: string;
  part: string;          // "A" | "B" etc.
  deductorTan: string;
  deductorName: string;
  section: string;       // "194J" | "194C" etc.
  quarter: string;       // "Q1"–"Q4" or "" if absent
  amountPaid: number;
  tdsDeducted: number;
  bookingStatus: string; // "F" (Final) | "P" (Pending)
}

export interface TdsRegEntry {
  docId: string;
  name: string;
  pan: string;
  section: string;
  quarter: string;
  fy: string;
  amountPaid: number;
  tdsAmount: number;
}

export interface Recon26asRow {
  status: ReconStatus26as;
  section: string;
  sectionLabel: string;
  quarter: string;
  deductorName: string;
  deductorTan: string;
  reg?: { docId: string; amountPaid: number; tdsAmount: number; name: string };
  as26?: { id: string; amountPaid: number; tdsDeducted: number; bookingStatus: string };
}

// ---- Reconciliation engine --------------------------------------------------

const TOLERANCE = 2; // ₹2 rounding tolerance

function normSec(s: string): string {
  return s.replace(/[\s\-]/g, "").toUpperCase();
}

export function reconcile26as(
  register: TdsRegEntry[],
  twoSixAs: Form26asEntry[],
): Recon26asRow[] {
  const rows: Recon26asRow[] = [];
  const usedAs = new Set<string>();

  for (const r of register) {
    const normR = normSec(r.section);

    // Match on section; prefer exact quarter match, fall back to quarter-agnostic
    // (some 26AS exports omit the quarter column entirely)
    const match =
      twoSixAs.find(
        (e) =>
          !usedAs.has(e.id) &&
          normSec(e.section) === normR &&
          e.quarter === r.quarter,
      ) ??
      twoSixAs.find(
        (e) =>
          !usedAs.has(e.id) &&
          normSec(e.section) === normR &&
          (!e.quarter || !r.quarter),
      );

    const sLabel = TDS_SECTIONS[r.section] ?? "";

    if (!match) {
      rows.push({
        status: "register_only",
        section: r.section,
        sectionLabel: sLabel,
        quarter: r.quarter,
        deductorName: r.name,
        deductorTan: "",
        reg: { docId: r.docId, amountPaid: r.amountPaid, tdsAmount: r.tdsAmount, name: r.name },
      });
      continue;
    }

    usedAs.add(match.id);
    const amtOk = Math.abs(r.tdsAmount - match.tdsDeducted) <= TOLERANCE;

    rows.push({
      status: amtOk ? "matched" : "amount_mismatch",
      section: r.section,
      sectionLabel: sLabel,
      quarter: r.quarter || match.quarter,
      deductorName: match.deductorName || r.name,
      deductorTan: match.deductorTan,
      reg: { docId: r.docId, amountPaid: r.amountPaid, tdsAmount: r.tdsAmount, name: r.name },
      as26: {
        id: match.id,
        amountPaid: match.amountPaid,
        tdsDeducted: match.tdsDeducted,
        bookingStatus: match.bookingStatus,
      },
    });
  }

  // Unmatched 26AS entries = unclaimed TDS credits
  for (const e of twoSixAs) {
    if (usedAs.has(e.id)) continue;
    rows.push({
      status: "26as_only",
      section: e.section,
      sectionLabel: TDS_SECTIONS[e.section] ?? "",
      quarter: e.quarter,
      deductorName: e.deductorName,
      deductorTan: e.deductorTan,
      as26: {
        id: e.id,
        amountPaid: e.amountPaid,
        tdsDeducted: e.tdsDeducted,
        bookingStatus: e.bookingStatus,
      },
    });
  }

  const order: Record<ReconStatus26as, number> = {
    amount_mismatch: 0,
    register_only: 1,
    "26as_only": 2,
    matched: 3,
  };
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

// ---- TRACES text parser -----------------------------------------------------
// Handles the .txt download from the TRACES portal (most common CA workflow).
// Column order in Part A: TAN | Name | Section | Amount Paid | Tax Deducted |
// Surcharge | Cess | Total TDS | Booking Status
// Format varies (pipe-delimited, space-aligned, fixed-width) — we use TAN
// as an anchor and extract surrounding values heuristically.

const TAN_RE = /\b([A-Z]{4}[0-9]{5}[A-Z])\b/;

const MONTH_TO_QUARTER: Record<string, string> = {
  APR: "Q1", MAY: "Q1", JUN: "Q1",
  JUL: "Q2", AUG: "Q2", SEP: "Q2",
  OCT: "Q3", NOV: "Q3", DEC: "Q3",
  JAN: "Q4", FEB: "Q4", MAR: "Q4",
};

export function parseForm26asText(text: string): Form26asEntry[] {
  const raw   = text;
  const upper = text.toUpperCase();
  const lines      = raw.split(/\r?\n/);
  const upperLines = upper.split(/\r?\n/);

  const entries: Form26asEntry[] = [];
  const seen = new Set<string>(); // dedup key: tan|section|round(tds)
  let currentPart = "A";

  for (let i = 0; i < lines.length; i++) {
    const uLine = upperLines[i].trim();

    // Track Part boundary
    const partM = uLine.match(/\bPART\s+([A-F])\b/);
    if (partM) { currentPart = partM[1]; continue; }

    // Only process lines anchored by a TAN
    const tanM = uLine.match(TAN_RE);
    if (!tanM) continue;

    const tan = tanM[1];

    // Context: this line + next 3 (handle multi-line/wrapped entries)
    const ctxRaw   = lines.slice(i, i + 4).join(" ");
    const ctxUpper = upperLines.slice(i, i + 4).join(" ");

    // Section — reuse IT Act pattern from india.ts
    const secM = ctxUpper.match(/\b(1(?:9[2-9])[A-Z]{0,2}|206C|195)\b/);
    const section = secM ? secM[1].replace(/-/g, "") : "";

    // Quarter — explicit "Q1"/"Q2" or derived from month name
    let quarter = "";
    const qM = ctxUpper.match(/\bQ([1-4])\b/);
    if (qM) {
      quarter = `Q${qM[1]}`;
    } else {
      const monM = ctxUpper.match(
        /\b(APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|JAN|FEB|MAR)\b/,
      );
      if (monM) quarter = MONTH_TO_QUARTER[monM[1]] ?? "";
    }

    // Booking status: "F" (Final) or "P" (Pending/Provisional)
    const stM = ctxUpper.match(/\b([FP])\b(?=\s|$|[|,])/);
    const bookingStatus = stM?.[1] ?? "";

    // Rupee amounts: all comma-formatted numbers ≥ 100 (exclude serial no., years)
    const amounts = extractInrAmounts(ctxRaw);
    // Column order in TRACES: amount_paid | tds_deducted | surcharge | cess | total
    // Largest non-equal pair: [0] = gross, [1] = TDS (usually equal to total when no surcharge)
    const amountPaid  = amounts[0] ?? 0;
    const tdsDeducted = amounts[1] ?? 0;

    // Deductor name: text between TAN and section/amount, cleaned
    const deductorName = extractDeductorName(lines[i], tan);

    // Deduplicate: same deductor + section + TDS amount → skip
    const key = `${tan}|${section}|${Math.round(tdsDeducted)}`;
    if (seen.has(key) && tdsDeducted > 0) continue;
    seen.add(key);

    entries.push({
      id: crypto.randomUUID(),
      part: currentPart,
      deductorTan: tan,
      deductorName,
      section,
      quarter,
      amountPaid,
      tdsDeducted,
      bookingStatus,
    });
  }

  return entries;
}

function extractInrAmounts(text: string): number[] {
  // Match 1,23,456.78 (Indian grouping) or 1,234.56 (western) — min 3 digits total
  const re = /\b(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d{4,}(?:\.\d{1,2})?)\b/g;
  const vals: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (isFinite(n) && n >= 100) vals.push(n); // ignore S.No, years, rate %
  }
  return vals.sort((a, b) => b - a);
}

function extractDeductorName(line: string, tan: string): string {
  const idx = line.toUpperCase().indexOf(tan);
  if (idx < 0) return "";
  const after = line.slice(idx + tan.length);
  // Take text up to the first section code, digit cluster, or pipe
  const name = after.split(/\s{2,}|\||\d{5,}|1(?:9[2-9])|206C|195/)[0] ?? "";
  return name.trim().replace(/[^A-Za-z0-9 &.,\-'()/]/g, "").trim().slice(0, 60);
}

// ---- JSON parser (fallback for structured exports) --------------------------
// Tries common shapes: array at root, or nested under data/tdsDetails/partA.

export function parseForm26asJson(raw: unknown): Form26asEntry[] {
  const entries: Form26asEntry[] = [];

  const tryArray = (arr: unknown[]): boolean => {
    if (!arr.length) return false;
    const first = arr[0] as Record<string, unknown>;
    // Must look like a TDS row: has a TAN-like field and numeric TDS
    const keys = Object.keys(first).map((k) => k.toLowerCase());
    if (!keys.some((k) => k.includes("tan") || k.includes("deductor"))) return false;

    for (const item of arr) {
      const r = item as Record<string, unknown>;
      const getStr = (keys: string[]) =>
        String(keys.map((k) => r[k] ?? r[k.toUpperCase()] ?? r[k.toLowerCase()] ?? "").find(Boolean) ?? "");
      const getNum = (keys: string[]) => {
        const v = keys.map((k) => r[k] ?? r[k.toUpperCase()] ?? r[k.toLowerCase()] ?? 0).find(
          (x) => typeof x === "number" && x > 0,
        );
        return typeof v === "number" ? v : 0;
      };

      const tan     = getStr(["TAN", "deductorTAN", "deductor_tan", "tan"]);
      const name    = getStr(["Name", "deductorName", "deductor_name", "name"]);
      const section = getStr(["Section", "sectionCode", "section_code", "section"]).replace(/[\s\-]/g, "").toUpperCase();
      const quarter = getStr(["Quarter", "quarter"]).toUpperCase().match(/Q([1-4])/)?.[0] ?? "";
      const paid    = getNum(["AmountPaid", "amount_paid", "amountPaid", "paid"]);
      const tds     = getNum(["TaxDeducted", "tds_deducted", "taxDeducted", "tds"]);
      const status  = getStr(["Status", "bookingStatus", "booking_status", "status"]).toUpperCase().slice(0, 1);

      entries.push({
        id: crypto.randomUUID(),
        part: getStr(["Part", "part"]).toUpperCase().slice(0, 1) || "A",
        deductorTan: tan,
        deductorName: name,
        section,
        quarter,
        amountPaid: paid,
        tdsDeducted: tds,
        bookingStatus: status,
      });
    }
    return entries.length > 0;
  };

  if (Array.isArray(raw)) { tryArray(raw); return entries; }

  const root = raw as Record<string, unknown>;
  for (const key of ["tdsDetails", "partA", "Part_A", "data", "entries", "rows"]) {
    if (Array.isArray(root[key])) {
      if (tryArray(root[key] as unknown[])) return entries;
    }
  }

  // Nested: root.data.tdsDetails etc.
  for (const topKey of Object.keys(root)) {
    const sub = root[topKey];
    if (sub && typeof sub === "object" && !Array.isArray(sub)) {
      const subR = sub as Record<string, unknown>;
      for (const innerKey of Object.keys(subR)) {
        if (Array.isArray(subR[innerKey])) {
          if (tryArray(subR[innerKey] as unknown[])) return entries;
        }
      }
    }
  }

  return entries;
}
