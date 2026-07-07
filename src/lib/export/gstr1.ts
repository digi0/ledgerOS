/**
 * GSTN GSTR-1 export adapter. Turns a firm's parsed OUTWARD (sales) invoices
 * for a client into the GSTR-1 JSON that the GST portal ingests — the same
 * interchange format TallyPrime / ClearTax / Zoho generate. The CA reviews it
 * and uploads to the portal (or the offline tool). No GSP license needed.
 * See docs/integration-pipeline.md.
 *
 * Pure. Validated against a real filed return (Gujarat Organisors, GSTR-1
 * Jan–Mar 2026) — see scripts/test-gstr1.ts. Reference for the section split
 * (b2b / b2cs / hsn / docs) is the government's GSTR-1 offline-tool template.
 */

import { round2, splitGst } from "../gst";

/** Invoice classification the return needs. "R" = Regular B2B, SEZ with /
 *  without payment, Deemed Export. */
export type Gstr1InvoiceType = "R" | "SEWP" | "SEWOP" | "DE";

/** One outward supply line the adapter consumes — a GSTR-1 projection of a
 *  parsed sales invoice. recipientGstin === null ⇒ B2C (unregistered). */
export interface Gstr1SalesLine {
  recipientGstin: string | null;
  recipientName: string;
  invoiceNo: string;
  invoiceDate: string; // ISO "YYYY-MM-DD"
  invoiceValue: number; // gross (taxable + tax + cess)
  pos: string; // 2-digit state code, e.g. "24"
  rate: number; // % — 18, 12, 5, …
  taxableValue: number;
  cess?: number;
  reverseCharge?: boolean;
  invoiceType?: Gstr1InvoiceType;
  ecommerceGstin?: string | null;
  // HSN summary inputs (mandatory in GSTR-1 table 12)
  hsn?: string;
  hsnDescription?: string;
  uqc?: string; // e.g. "MTR", "NOS"
  quantity?: number;
}

export interface Gstr1Options {
  supplierGstin: string;
  /** Return period as "YYYY-MM". Emitted as "MMYYYY" in the JSON (`fp`). */
  period: string;
  invoices: Gstr1SalesLine[];
  /** Document-issued summary (table 13). Optional — omitted if absent. */
  docIssue?: { from: string; to: string; totalIssued: number; cancelled?: number };
}

// ── GSTR-1 JSON shape (the subset we emit) ───────────────────────────────
interface ItemDetail {
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}
interface B2bInvoice {
  inum: string;
  idt: string; // DD-MM-YYYY
  val: number;
  pos: string;
  rchrg: "Y" | "N";
  inv_typ: Gstr1InvoiceType;
  itms: { num: number; itm_det: ItemDetail }[];
}
interface B2bGroup {
  ctin: string;
  inv: B2bInvoice[];
}
interface B2csEntry {
  sply_ty: "INTRA" | "INTER";
  pos: string;
  typ: "OE";
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
}
interface HsnEntry {
  num: number;
  hsn_sc: string;
  desc: string;
  uqc: string;
  qty: number;
  rt: number;
  txval: number;
  iamt: number;
  camt: number;
  samt: number;
  csamt: number;
  val: number;
}
interface DocIssue {
  doc_det: { doc_num: number; docs: { num: number; from: string; to: string; totnum: number; cancel: number; net_issue: number }[] }[];
}
export interface Gstr1Return {
  gstin: string;
  fp: string;
  b2b?: B2bGroup[];
  b2cs?: B2csEntry[];
  hsn?: { data: HsnEntry[] };
  doc_issue?: DocIssue;
}

// ── helpers ──────────────────────────────────────────────────────────────

const r2 = round2;

function stateOf(gstin: string): string {
  return gstin.slice(0, 2);
}

/** "YYYY-MM-DD" → "DD-MM-YYYY" (GSTN date format). */
function gstDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Split into GSTN's iamt/camt/samt naming via the shared GST helper. */
function taxSplit(taxable: number, rate: number, supplierState: string, pos: string) {
  const { cgst, sgst, igst } = splitGst(taxable, rate, supplierState, pos);
  return { iamt: igst, camt: cgst, samt: sgst };
}

// ── builder ──────────────────────────────────────────────────────────────

export function buildGstr1(opts: Gstr1Options): Gstr1Return {
  const { supplierGstin, period, invoices } = opts;
  const supplierState = stateOf(supplierGstin);
  const [yyyy, mm] = period.split("-");

  const ret: Gstr1Return = { gstin: supplierGstin, fp: `${mm}${yyyy}` };

  const b2bLines = invoices.filter((i) => i.recipientGstin);
  const b2cLines = invoices.filter((i) => !i.recipientGstin);

  // ── B2B: group by recipient GSTIN, one inv[] per counterparty ──
  if (b2bLines.length) {
    // Group by recipient, then by invoice number — a single invoice can carry
    // several rate items (e.g. a generated multi-rate invoice), which GSTN
    // wants as one inv with multiple itms, NOT repeated invoice numbers.
    const byCtin = new Map<string, Map<string, B2bInvoice>>();
    for (const i of b2bLines) {
      const split = taxSplit(i.taxableValue, i.rate, supplierState, i.pos);
      const ctin = i.recipientGstin!;
      const invs = byCtin.get(ctin) ?? byCtin.set(ctin, new Map()).get(ctin)!;
      const existing = invs.get(i.invoiceNo);
      const itm_det = { rt: i.rate, txval: r2(i.taxableValue), csamt: r2(i.cess ?? 0), ...split };
      if (existing) {
        existing.itms.push({ num: existing.itms.length + 1, itm_det });
      } else {
        invs.set(i.invoiceNo, {
          inum: i.invoiceNo,
          idt: gstDate(i.invoiceDate),
          val: r2(i.invoiceValue),
          pos: i.pos,
          rchrg: i.reverseCharge ? "Y" : "N",
          inv_typ: i.invoiceType ?? "R",
          itms: [{ num: 1, itm_det }],
        });
      }
    }
    ret.b2b = [...byCtin].map(([ctin, invs]) => ({ ctin, inv: [...invs.values()] }));
  }

  // ── B2CS: summarise unregistered supplies by (pos, rate, intra/inter) ──
  if (b2cLines.length) {
    const byKey = new Map<string, B2csEntry>();
    for (const i of b2cLines) {
      const intra = i.pos === supplierState;
      const key = `${i.pos}|${i.rate}|${intra}`;
      const split = taxSplit(i.taxableValue, i.rate, supplierState, i.pos);
      const e =
        byKey.get(key) ??
        byKey
          .set(key, {
            sply_ty: intra ? "INTRA" : "INTER",
            pos: i.pos,
            typ: "OE",
            rt: i.rate,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0,
          })
          .get(key)!;
      e.txval = r2(e.txval + i.taxableValue);
      e.iamt = r2(e.iamt + split.iamt);
      e.camt = r2(e.camt + split.camt);
      e.samt = r2(e.samt + split.samt);
      e.csamt = r2(e.csamt + (i.cess ?? 0));
    }
    ret.b2cs = [...byKey.values()];
  }

  // ── HSN summary (table 12): aggregate by (hsn, rate) ──
  const hsnLines = invoices.filter((i) => i.hsn);
  if (hsnLines.length) {
    const byHsn = new Map<string, HsnEntry>();
    let num = 0;
    for (const i of hsnLines) {
      const key = `${i.hsn}|${i.rate}`;
      const split = taxSplit(i.taxableValue, i.rate, supplierState, i.pos);
      const e =
        byHsn.get(key) ??
        byHsn
          .set(key, {
            num: ++num,
            hsn_sc: i.hsn!,
            desc: i.hsnDescription ?? "",
            uqc: i.uqc ?? "NA",
            qty: 0,
            rt: i.rate,
            txval: 0,
            iamt: 0,
            camt: 0,
            samt: 0,
            csamt: 0,
            val: 0,
          })
          .get(key)!;
      e.qty = r2(e.qty + (i.quantity ?? 0));
      e.txval = r2(e.txval + i.taxableValue);
      e.iamt = r2(e.iamt + split.iamt);
      e.camt = r2(e.camt + split.camt);
      e.samt = r2(e.samt + split.samt);
      e.csamt = r2(e.csamt + (i.cess ?? 0));
      e.val = r2(e.val + i.invoiceValue);
    }
    ret.hsn = { data: [...byHsn.values()] };
  }

  // ── Document-issued summary (table 13) ──
  if (opts.docIssue) {
    const d = opts.docIssue;
    const cancel = d.cancelled ?? 0;
    ret.doc_issue = {
      doc_det: [
        {
          doc_num: 1, // 1 = Invoices for outward supply
          docs: [{ num: 1, from: d.from, to: d.to, totnum: d.totalIssued, cancel, net_issue: d.totalIssued - cancel }],
        },
      ],
    };
  }

  return ret;
}

// ── review summary (mirrors the offline-tool template's summary rows) ────

export interface Gstr1Summary {
  b2b: { recipients: number; invoices: number; invoiceValue: number; taxable: number; cess: number };
  b2cs: { taxable: number; cess: number };
  hsn: { count: number; value: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number };
  totalTaxable: number;
}

/** Human-facing totals for the export review screen — and the assertion
 *  surface the oracle test checks against the real filed return. */
export function summarise(ret: Gstr1Return): Gstr1Summary {
  const b2bInvs = (ret.b2b ?? []).flatMap((g) => g.inv);
  const b2bTaxable = r2(b2bInvs.reduce((s, i) => s + i.itms.reduce((t, x) => t + x.itm_det.txval, 0), 0));
  const b2csTaxable = r2((ret.b2cs ?? []).reduce((s, e) => s + e.txval, 0));
  const hsn = ret.hsn?.data ?? [];
  return {
    b2b: {
      recipients: (ret.b2b ?? []).length,
      invoices: b2bInvs.length,
      invoiceValue: r2(b2bInvs.reduce((s, i) => s + i.val, 0)),
      taxable: b2bTaxable,
      cess: r2(b2bInvs.reduce((s, i) => s + i.itms.reduce((t, x) => t + x.itm_det.csamt, 0), 0)),
    },
    b2cs: { taxable: b2csTaxable, cess: r2((ret.b2cs ?? []).reduce((s, e) => s + e.csamt, 0)) },
    hsn: {
      count: hsn.length,
      value: r2(hsn.reduce((s, h) => s + h.val, 0)),
      taxable: r2(hsn.reduce((s, h) => s + h.txval, 0)),
      igst: r2(hsn.reduce((s, h) => s + h.iamt, 0)),
      cgst: r2(hsn.reduce((s, h) => s + h.camt, 0)),
      sgst: r2(hsn.reduce((s, h) => s + h.samt, 0)),
      cess: r2(hsn.reduce((s, h) => s + h.csamt, 0)),
    },
    totalTaxable: r2(b2bTaxable + b2csTaxable),
  };
}
