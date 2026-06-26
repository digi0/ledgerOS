/** Reconciliation engine: GSTR-2B entries vs purchase register rows. */

export type MatchStatus =
  | "matched"          // in both, amounts agree
  | "amount_mismatch"  // in both, taxable or GST differs > tolerance
  | "register_only"    // CA has invoice, supplier hasn't filed → ITC at risk
  | "2b_only";         // supplier filed, CA hasn't booked → needs entry

export interface RegisterEntry {
  docId: string;
  gstin: string;
  invoiceNo: string;
  date: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  vendor: string;
  clientName: string;
}

export interface Gstr2bEntry {
  id: string;
  supplierGstin: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  invoiceValue: number;
}

export interface ReconRow {
  status: MatchStatus;
  // identifiers
  gstin: string;
  vendorName: string;
  invoiceNo: string;
  invoiceDate: string;
  // register side (may be absent for 2b_only)
  reg?: Pick<RegisterEntry, "docId" | "taxable" | "cgst" | "sgst" | "igst" | "total">;
  // 2B side (may be absent for register_only)
  twoB?: Pick<Gstr2bEntry, "id" | "taxableValue" | "cgst" | "sgst" | "igst" | "invoiceValue">;
}

/** Amounts are considered matching within this rupee tolerance. */
const TOLERANCE = 2;

function normalise(s: string): string {
  return s.replace(/[\s\-\/\\\.]/g, "").toUpperCase();
}

function withinTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

export function reconcile(
  register: RegisterEntry[],
  twoB: Gstr2bEntry[],
): ReconRow[] {
  const rows: ReconRow[] = [];
  const usedTwoB = new Set<string>();

  for (const r of register) {
    const normGstin = normalise(r.gstin);
    const normInv = normalise(r.invoiceNo);

    // Find matching 2B entry by GSTIN + invoice number
    const match = twoB.find(
      (e) =>
        !usedTwoB.has(e.id) &&
        normalise(e.supplierGstin) === normGstin &&
        normalise(e.invoiceNumber) === normInv,
    );

    if (!match) {
      rows.push({
        status: "register_only",
        gstin: r.gstin,
        vendorName: r.vendor,
        invoiceNo: r.invoiceNo,
        invoiceDate: r.date,
        reg: { docId: r.docId, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, total: r.total },
      });
      continue;
    }

    usedTwoB.add(match.id);

    const taxableOk = withinTolerance(r.taxable, match.taxableValue);
    const cgstOk    = withinTolerance(r.cgst, match.cgst);
    const sgstOk    = withinTolerance(r.sgst, match.sgst);
    const igstOk    = withinTolerance(r.igst, match.igst);

    rows.push({
      status: taxableOk && cgstOk && sgstOk && igstOk ? "matched" : "amount_mismatch",
      gstin: r.gstin,
      vendorName: r.vendor || match.supplierName,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.date || match.invoiceDate,
      reg: { docId: r.docId, taxable: r.taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst, total: r.total },
      twoB: { id: match.id, taxableValue: match.taxableValue, cgst: match.cgst, sgst: match.sgst, igst: match.igst, invoiceValue: match.invoiceValue },
    });
  }

  // Remaining 2B entries have no register counterpart
  for (const e of twoB) {
    if (usedTwoB.has(e.id)) continue;
    rows.push({
      status: "2b_only",
      gstin: e.supplierGstin,
      vendorName: e.supplierName,
      invoiceNo: e.invoiceNumber,
      invoiceDate: e.invoiceDate,
      twoB: { id: e.id, taxableValue: e.taxableValue, cgst: e.cgst, sgst: e.sgst, igst: e.igst, invoiceValue: e.invoiceValue },
    });
  }

  // Sort: mismatches + ITC-at-risk first, then 2B-only, then matched
  const order: Record<MatchStatus, number> = {
    amount_mismatch: 0,
    register_only: 1,
    "2b_only": 2,
    matched: 3,
  };
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

/** Parse a GSTR-2B JSON export (portal format) into flat entry rows. */
export function parseGstr2bJson(raw: unknown): Gstr2bEntry[] {
  const entries: Gstr2bEntry[] = [];

  const root = raw as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const docdata = (data.docdata ?? {}) as Record<string, unknown>;
  const b2b = Array.isArray(docdata.b2b) ? docdata.b2b : [];

  for (const supplier of b2b) {
    const s = supplier as Record<string, unknown>;
    const ctin = String(s.ctin ?? "");
    const trdnm = String(s.trdnm ?? s.tradeName ?? "");
    const invoices = Array.isArray(s.inv) ? s.inv : [];

    for (const inv of invoices) {
      const i = inv as Record<string, unknown>;
      const items = Array.isArray(i.itms) ? i.itms : [];

      // Sum all line items
      let txval = 0, cgst = 0, sgst = 0, igst = 0, cess = 0;
      for (const itm of items) {
        const det = (itm as Record<string, unknown>).itm_det as Record<string, unknown> | undefined;
        if (!det) continue;
        txval += Number(det.txval ?? 0);
        cgst  += Number(det.cgst  ?? 0);
        sgst  += Number(det.sgst  ?? 0);
        igst  += Number(det.igst  ?? 0);
        cess  += Number(det.cess  ?? 0);
      }

      // Convert DD/MM/YYYY → YYYY-MM-DD
      const rawDate = String(i.idt ?? "");
      const isoDate = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        ? `${rawDate.slice(6)}-${rawDate.slice(3, 5)}-${rawDate.slice(0, 2)}`
        : rawDate;

      entries.push({
        id:              crypto.randomUUID(),
        supplierGstin:   ctin,
        supplierName:    trdnm,
        invoiceNumber:   String(i.inum ?? ""),
        invoiceDate:     isoDate,
        invoiceValue:    Number(i.val ?? txval + cgst + sgst + igst),
        taxableValue:    txval,
        cgst, sgst, igst,
      });
    }
  }

  return entries;
}
