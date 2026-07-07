/**
 * Shared GST arithmetic — one source of truth for the intra/inter-state tax
 * split, used by both the invoice generator (computing tax at issue) and the
 * GSTR-1 adapter (splitting parsed/generated supplies). Pure.
 *
 * Rule: a supply is intra-state (CGST + SGST, half each) when the place of
 * supply is the supplier's own state; otherwise inter-state (IGST). Both
 * driven by the 2-digit GST state code (first two chars of a GSTIN).
 */

/** Round to 2 decimals (paise) — GSTN rejects longer fractions. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** First two digits of a GSTIN = the GST state code, or null if malformed. */
export function stateCode(gstin: string | null | undefined): string | null {
  return gstin && gstin.length >= 2 ? gstin.slice(0, 2) : null;
}

export interface GstSplit {
  cgst: number;
  sgst: number;
  igst: number;
}

/**
 * Split a taxable amount at `rate`% into CGST/SGST (intra-state) or IGST
 * (inter-state), decided by supplier state vs place of supply.
 */
export function splitGst(taxable: number, rate: number, supplierState: string, placeOfSupply: string): GstSplit {
  if (placeOfSupply === supplierState) {
    const half = round2((taxable * rate) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: round2((taxable * rate) / 100) };
}

/** Indian financial year (Apr–Mar) for an ISO date, e.g. "2026-06-12" → "2026-27". */
export function financialYear(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
