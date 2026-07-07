/**
 * Document → Gstr1SalesLine bridge. Turns parsed invoice documents into the
 * neutral GSTR-1 sales lines the adapter (./gstr1) consumes, then assembles a
 * client's return.
 *
 * The crux: GSTR-1 is OUTWARD (sales) supply, but the parser reads every
 * invoice from the seller's side. We disambiguate using the CLIENT'S OWN GSTIN
 * as ground truth — an invoice is an outward supply for this client only when
 * the client is the seller. The other GSTIN on the invoice is the recipient.
 * Anything where the client is the buyer is an inward (purchase) invoice and is
 * skipped, with a reason, rather than silently mis-filed.
 */

import type { Client, DocumentRow } from "../types";
import { buildGstr1, type Gstr1Options, type Gstr1Return, type Gstr1SalesLine } from "./gstr1";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

function normGstin(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const g = v.replace(/\s+/g, "").toUpperCase();
  return GSTIN_RE.test(g) ? g : null;
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface BridgeResult {
  line: Gstr1SalesLine | null;
  /** Why this doc is not an outward supply for the client (null when accepted). */
  skip: string | null;
  /** Data-quality flags on an accepted line — surfaced for CA review, never hidden. */
  warnings: string[];
}

/** Convert one document to a GSTR-1 sales line, judged against the client's GSTIN. */
export function documentToGstr1Line(doc: DocumentRow, clientGstin: string): BridgeResult {
  const skip = (reason: string): BridgeResult => ({ line: null, skip: reason, warnings: [] });

  if (doc.classification !== "invoice") return skip("not an invoice");

  const client = normGstin(clientGstin);
  if (!client) return skip("client has no valid GSTIN");

  const f = doc.extracted_fields;
  const seller = normGstin(f.gstin);
  const all = new Set<string>();
  if (Array.isArray(f.all_gstins)) for (const g of f.all_gstins) { const n = normGstin(g); if (n) all.add(n); }
  if (seller) all.add(seller);

  if (!all.has(client)) return skip("client GSTIN not on invoice — can't confirm an outward supply");
  if (seller && seller !== client) return skip("inward (purchase) invoice — client is the buyer");
  if (!seller) return skip("no seller GSTIN parsed — can't confirm the client is the supplier");

  const recipients = [...all].filter((g) => g !== client);
  const recipientGstin = recipients[0] ?? null; // null ⇒ B2C (unregistered)

  const warnings: string[] = [];
  const taxable = num(f.taxable_value);
  const tax = num(f.cgst) + num(f.sgst) + num(f.igst);
  const total = num(f.total);
  const cess = num(f.cess);

  let rate = 0;
  if (taxable > 0) rate = r2((tax / taxable) * 100);
  else warnings.push("No taxable value parsed — GST rate could not be derived.");

  const recipientName = str(f.buyer_name);
  if (recipientGstin && !recipientName) warnings.push("Recipient name not parsed (portal keys on GSTIN, but review).");

  // POS: registered recipient → their state; B2C → assume supplier state (warn).
  let pos: string;
  if (recipientGstin) pos = recipientGstin.slice(0, 2);
  else { pos = client.slice(0, 2); warnings.push("B2C supply — place of supply assumed = supplier state; verify."); }

  const invoiceNo = str(f.invoice_number);
  if (!invoiceNo) warnings.push("No invoice number parsed — GSTR-1 requires it.");

  const hsn = Array.isArray(f.hsn_codes) ? str(f.hsn_codes[0]) : null;
  if (!hsn) warnings.push("No HSN/SAC parsed — required for the table-12 summary.");

  const line: Gstr1SalesLine = {
    recipientGstin,
    recipientName: recipientName ?? "",
    invoiceNo: invoiceNo ?? "",
    invoiceDate: str(f.date) ?? doc.created_at.slice(0, 10),
    invoiceValue: total || r2(taxable + tax + cess),
    pos,
    rate,
    taxableValue: taxable,
    cess: cess || undefined,
    reverseCharge: false,
    invoiceType: "R",
    hsn: hsn ?? undefined,
    uqc: hsn ? "NA" : undefined,
  };
  return { line, skip: null, warnings };
}

export interface Gstr1BuildResult {
  return: Gstr1Return;
  included: number;
  skipped: { docId: string; filename: string; reason: string }[];
  flagged: { docId: string; filename: string; messages: string[] }[];
}

/**
 * Assemble a client's GSTR-1 from their invoice documents. Docs are the
 * caller's responsibility to scope to the period (as the register page does);
 * this only classifies, converts, and aggregates.
 */
export function buildClientGstr1(args: {
  client: Pick<Client, "gstin" | "name">;
  period: string; // "YYYY-MM"
  docs: DocumentRow[];
  docIssue?: Gstr1Options["docIssue"];
}): Gstr1BuildResult {
  const { client, period, docs, docIssue } = args;
  const gstin = client.gstin;

  const invoices: Gstr1SalesLine[] = [];
  const skipped: Gstr1BuildResult["skipped"] = [];
  const flagged: Gstr1BuildResult["flagged"] = [];

  if (!normGstin(gstin ?? "")) {
    // No client GSTIN → nothing can be an outward supply. Empty return.
    return {
      return: buildGstr1({ supplierGstin: gstin ?? "", period, invoices: [], docIssue }),
      included: 0,
      skipped: docs.map((d) => ({ docId: d.id, filename: d.filename, reason: "client has no valid GSTIN" })),
      flagged: [],
    };
  }

  for (const doc of docs) {
    const { line, skip, warnings } = documentToGstr1Line(doc, gstin!);
    if (skip) { skipped.push({ docId: doc.id, filename: doc.filename, reason: skip }); continue; }
    invoices.push(line!);
    if (warnings.length) flagged.push({ docId: doc.id, filename: doc.filename, messages: warnings });
  }

  // Table 13 (documents issued) is required for filing and derivable from the
  // outward invoice series — auto-fill it (best-effort) when not supplied.
  const effectiveDocIssue = docIssue ?? deriveDocIssue(invoices);

  return {
    return: buildGstr1({ supplierGstin: gstin!, period, invoices, docIssue: effectiveDocIssue }),
    included: invoices.length,
    skipped,
    flagged,
  };
}

/** Natural comparator so "G/9" sorts before "G/30" (numeric chunks compared as
 *  numbers, text chunks lexically). */
function naturalCompare(a: string, b: string): number {
  const ax = a.match(/\d+|\D+/g) ?? [];
  const bx = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    const x = ax[i] ?? "", y = bx[i] ?? "";
    const nx = /^\d/.test(x), ny = /^\d/.test(y);
    const c = nx && ny ? Number(x) - Number(y) : x.localeCompare(y);
    if (c) return c;
  }
  return 0;
}

/** Best-effort documents-issued summary from the outward invoice numbers. */
function deriveDocIssue(invoices: Gstr1SalesLine[]): Gstr1Options["docIssue"] | undefined {
  const nums = invoices.map((i) => i.invoiceNo).filter(Boolean).sort(naturalCompare);
  if (!nums.length) return undefined;
  return { from: nums[0], to: nums[nums.length - 1], totalIssued: nums.length, cancelled: 0 };
}
