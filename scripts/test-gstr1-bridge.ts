/**
 * Document → Gstr1SalesLine bridge tests. Run:
 *   npx tsx scripts/test-gstr1-bridge.ts
 */

import type { DocumentRow } from "../src/lib/types";
import { documentToGstr1Line, buildClientGstr1 } from "../src/lib/export/gstr1-bridge";
import { summarise } from "../src/lib/export/gstr1";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const CLIENT = "24AAACG0000A1Z0"; // Gujarat supplier (our client)
const BUYER_REG = "24AAAAA0001A1Z5"; // registered recipient, Gujarat
const BUYER_MH = "27AAAAA0002A1Z4"; // registered recipient, Maharashtra
const VENDOR = "29AAAAA0003A1Z3"; // some vendor (Karnataka)

function doc(fields: Record<string, unknown>, over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "doc-1", firm_id: "f", client_id: "c", source_email_id: null,
    filename: "inv.pdf", mime_type: "application/pdf", size_bytes: 1, storage_path: "x",
    ocr_text: null, classification: "invoice", classification_confidence: 0.97,
    extracted_fields: fields, status: "ready", handling: "new", error: null,
    created_at: "2026-06-30T00:00:00Z", updated_at: "2026-06-30T00:00:00Z",
    client: { id: "c", name: "Malpani & Associates" }, ...over,
  };
}

console.log("outward sales invoice (client is seller) → B2B line");
{
  const { line, skip, warnings } = documentToGstr1Line(
    doc({
      gstin: CLIENT, all_gstins: [CLIENT, BUYER_REG], buyer_name: "Neminath Sarees",
      invoice_number: "G/31", date: "2026-01-21", taxable_value: 451000, cgst: 40590, sgst: 40590, total: 532180,
      hsn_codes: ["997212"],
    }),
    CLIENT,
  );
  check("accepted (not skipped)", skip === null, skip ?? "");
  check("recipient = the OTHER gstin", line?.recipientGstin === BUYER_REG, line?.recipientGstin ?? "null");
  check("recipient name from buyer_name", line?.recipientName === "Neminath Sarees");
  check("rate derived = 18", line?.rate === 18, String(line?.rate));
  check("POS = recipient state 24", line?.pos === "24", line?.pos);
  check("no warnings on a clean invoice", warnings.length === 0, warnings.join("; "));
}

console.log("inward purchase invoice (client is buyer) → skipped");
{
  const { line, skip } = documentToGstr1Line(
    doc({ gstin: VENDOR, all_gstins: [VENDOR, CLIENT], invoice_number: "V-1", taxable_value: 1000, cgst: 90, sgst: 90, total: 1180 }),
    CLIENT,
  );
  check("skipped as inward", line === null && /inward/.test(skip ?? ""), skip ?? "");
}

console.log("client GSTIN absent → skipped");
{
  const { skip } = documentToGstr1Line(
    doc({ gstin: VENDOR, all_gstins: [VENDOR, BUYER_MH], invoice_number: "X-1", taxable_value: 1000 }),
    CLIENT,
  );
  check("skipped (client not on invoice)", /not on invoice/.test(skip ?? ""), skip ?? "");
}

console.log("B2C (only client GSTIN, no recipient) → B2C line + warning");
{
  const { line, warnings } = documentToGstr1Line(
    doc({ gstin: CLIENT, all_gstins: [CLIENT], invoice_number: "R-9", taxable_value: 1000, cgst: 90, sgst: 90, total: 1180, hsn_codes: ["997212"] }),
    CLIENT,
  );
  check("recipientGstin null ⇒ B2C", line?.recipientGstin === null);
  check("POS assumed = supplier state", line?.pos === "24");
  check("warns about assumed B2C POS", warnings.some((w) => /B2C/.test(w)));
}

console.log("inter-state outward → recipient in another state");
{
  const { line } = documentToGstr1Line(
    doc({ gstin: CLIENT, all_gstins: [CLIENT, BUYER_MH], buyer_name: "MH Co", invoice_number: "G/40", taxable_value: 100000, igst: 18000, total: 118000, hsn_codes: ["997212"] }),
    CLIENT,
  );
  check("POS = 27 (recipient's state)", line?.pos === "27", line?.pos);
  check("rate = 18 from IGST", line?.rate === 18, String(line?.rate));
}

console.log("missing invoice no / hsn → warnings, still accepted");
{
  const { line, warnings } = documentToGstr1Line(
    doc({ gstin: CLIENT, all_gstins: [CLIENT, BUYER_REG], buyer_name: "X", taxable_value: 1000, cgst: 90, sgst: 90, total: 1180 }),
    CLIENT,
  );
  check("still accepted", line !== null);
  check("warns: no invoice number", warnings.some((w) => /invoice number/.test(w)));
  check("warns: no HSN", warnings.some((w) => /HSN/.test(w)));
}

console.log("buildClientGstr1 — end to end (mixed inward + outward)");
{
  const docs: DocumentRow[] = [
    doc({ gstin: CLIENT, all_gstins: [CLIENT, BUYER_REG], buyer_name: "A", invoice_number: "G/30", date: "2026-01-06", taxable_value: 5000, cgst: 450, sgst: 450, total: 5900, hsn_codes: ["997212"] }, { id: "s1" }),
    doc({ gstin: CLIENT, all_gstins: [CLIENT, BUYER_MH], buyer_name: "B", invoice_number: "G/31", date: "2026-01-21", taxable_value: 451000, igst: 81180, total: 532180, hsn_codes: ["997212"] }, { id: "s2" }),
    doc({ gstin: VENDOR, all_gstins: [VENDOR, CLIENT], invoice_number: "P-1", taxable_value: 9999, cgst: 900, sgst: 900, total: 11799 }, { id: "p1" }), // inward → skipped
  ];
  const res = buildClientGstr1({
    client: { gstin: CLIENT, name: "Malpani" }, period: "2026-01", docs,
    docIssue: { from: "G/30", to: "G/31", totalIssued: 2 },
  });
  check("2 outward invoices included", res.included === 2, String(res.included));
  check("1 inward skipped", res.skipped.length === 1 && res.skipped[0].docId === "p1");
  check("return fp = 012026", res.return.fp === "012026");
  const s = summarise(res.return);
  check("summary taxable = 456000", s.b2b.taxable === 456000, String(s.b2b.taxable));
  check("intra CGST 450 + inter IGST 81180 → hsn cgst 450", s.hsn.cgst === 450, String(s.hsn.cgst));
  check("hsn igst = 81180", s.hsn.igst === 81180, String(s.hsn.igst));
  check("doc_issue carried through", res.return.doc_issue?.doc_det[0].docs[0].totnum === 2);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
