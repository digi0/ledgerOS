/**
 * Tally XML serializer golden tests. No DB — pure functions only.
 * Run: npx tsx scripts/test-tally.ts
 *
 * The assertions pin the two things Tally gets counter-intuitively: the
 * inverted sign convention (debit AMOUNT negative, credit positive) and that
 * every referenced ledger is emitted as a master before the vouchers.
 */

import type { DocumentRow } from "../src/lib/types";
import { documentToVoucher, documentsToVouchers, type Voucher } from "../src/lib/voucher";
import { vouchersToTallyXml } from "../src/lib/export/tally";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Minimal DocumentRow factory — only the fields the deriver reads. */
function doc(fields: Record<string, unknown>, over: Partial<DocumentRow> = {}): DocumentRow {
  return {
    id: "doc-1",
    firm_id: "firm-1",
    client_id: "client-1",
    source_email_id: null,
    filename: "invoice.pdf",
    mime_type: "application/pdf",
    size_bytes: 1000,
    storage_path: "x",
    ocr_text: null,
    classification: "invoice",
    classification_confidence: 0.97,
    extracted_fields: fields,
    status: "ready",
    handling: "new",
    error: null,
    created_at: "2026-06-30T00:00:00Z",
    updated_at: "2026-06-30T00:00:00Z",
    client: { id: "client-1", name: "Malpani & Associates" },
    ...over,
  };
}

/** Pull the <AMOUNT> for a given LEDGERNAME out of the emitted XML. */
function amountFor(xml: string, ledger: string): number | null {
  const re = new RegExp(
    `<LEDGERNAME>${ledger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</LEDGERNAME>\\s*<ISDEEMEDPOSITIVE>(Yes|No)</ISDEEMEDPOSITIVE>\\s*<AMOUNT>(-?[0-9.]+)</AMOUNT>`,
  );
  const m = re.exec(xml);
  return m ? parseFloat(m[2]) : null;
}
function deemedFor(xml: string, ledger: string): string | null {
  const re = new RegExp(
    `<LEDGERNAME>${ledger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</LEDGERNAME>\\s*<ISDEEMEDPOSITIVE>(Yes|No)</ISDEEMEDPOSITIVE>`,
  );
  const m = re.exec(xml);
  return m ? m[1] : null;
}

// ── Intra-state purchase → correct Tally shape & signs ───────────────────
console.log("intra-state purchase → Tally XML");
{
  const v = documentToVoucher(
    doc({
      vendor_name: "Krishna Motors",
      gstin: "27AABCK1234M1Z5",
      invoice_number: "KM/2026/0142",
      date: "2026-06-12",
      taxable_value: 10000,
      cgst: 900,
      sgst: 900,
      total: 11800,
    }),
  )!;
  const xml = vouchersToTallyXml([v]);

  check("well-formed envelope", xml.startsWith("<ENVELOPE>") && xml.trimEnd().endsWith("</ENVELOPE>"));
  check("import request header", xml.includes("<TALLYREQUEST>Import Data</TALLYREQUEST>"));
  check("voucher type = Purchase", xml.includes('VCHTYPE="Purchase"') && xml.includes("<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>"));
  check("date is YYYYMMDD", xml.includes("<DATE>20260612</DATE>"));
  check("party ledger on header", xml.includes("<PARTYLEDGERNAME>Krishna Motors</PARTYLEDGERNAME>"));
  check("invoice no → voucher number", xml.includes("<VOUCHERNUMBER>KM/2026/0142</VOUCHERNUMBER>"));

  // Sign convention — the crux.
  check("Purchases is a DEBIT (deemed positive Yes)", deemedFor(xml, "Purchases") === "Yes");
  check("Purchases AMOUNT is NEGATIVE (Tally debit)", amountFor(xml, "Purchases") === -10000);
  check("Input CGST debit −900", amountFor(xml, "Input CGST") === -900 && deemedFor(xml, "Input CGST") === "Yes");
  check("Input SGST debit −900", amountFor(xml, "Input SGST") === -900);
  check("party (vendor) is a CREDIT (deemed positive No)", deemedFor(xml, "Krishna Motors") === "No");
  check("party AMOUNT is POSITIVE +11800", amountFor(xml, "Krishna Motors") === 11800);

  // The whole voucher's Tally amounts must still sum to zero.
  const amounts = [...xml.matchAll(/<AMOUNT>(-?[0-9.]+)<\/AMOUNT>/g)].map((m) => parseFloat(m[1]));
  const sum = Math.round(amounts.reduce((s, n) => s + n, 0) * 100) / 100;
  check("Σ AMOUNT = 0 (balanced in Tally too)", sum === 0, `sum=${sum}`);

  // Masters emitted for every ledger, before the voucher.
  check("emits Purchases master", xml.includes("<LEDGER NAME=\"Purchases\" ACTION=\"Create\">"));
  check("Purchases master parented to Purchase Accounts", /<LEDGER NAME="Purchases"[\s\S]*?<PARENT>Purchase Accounts<\/PARENT>/.test(xml));
  check("Input CGST master → Duties & Taxes", /<LEDGER NAME="Input CGST"[\s\S]*?<PARENT>Duties &amp; Taxes<\/PARENT>/.test(xml));
  check("party master → Sundry Creditors", /<LEDGER NAME="Krishna Motors"[\s\S]*?<PARENT>Sundry Creditors<\/PARENT>/.test(xml));
  check("masters come before vouchers", xml.indexOf("<LEDGER ") < xml.indexOf("<VOUCHER "));
  check("deterministic REMOTEID from source doc", xml.includes("<REMOTEID>ledgeros-doc-1</REMOTEID>"));
}

// ── Inter-state (IGST) ───────────────────────────────────────────────────
console.log("inter-state purchase (IGST)");
{
  const v = documentToVoucher(
    doc({ vendor_name: "Chennai Steel Co", gstin: "33AABCC9999Q1Z2", invoice_number: "CS-88", taxable_value: 50000, igst: 9000, total: 59000 }),
  )!;
  const xml = vouchersToTallyXml([v]);
  check("Input IGST debit −9000", amountFor(xml, "Input IGST") === -9000);
  check("no CGST/SGST entries", !xml.includes("<LEDGERNAME>Input CGST</LEDGERNAME>"));
  check("party credited +59000", amountFor(xml, "Chennai Steel Co") === 59000);
}

// ── XML escaping in ledger names / narration ─────────────────────────────
console.log("escaping special characters");
{
  const v = documentToVoucher(
    doc({ vendor_name: "Tata & Sons <Steel>", gstin: "27AAAAA0000A1Z5", invoice_number: 'A"B&C', taxable_value: 1000 }),
  )!;
  const xml = vouchersToTallyXml([v]);
  check("ampersand & angle brackets escaped in ledger", xml.includes("Tata &amp; Sons &lt;Steel&gt;"));
  check("quote & amp escaped in voucher number", xml.includes("<VOUCHERNUMBER>A&quot;B&amp;C</VOUCHERNUMBER>"));
  check("no raw unescaped ampersand-space", !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml));
}

// ── Ledger-name mapping + company + createMasters:false ──────────────────
console.log("ledger map, company, masters off");
{
  const v = documentToVoucher(
    doc({ vendor_name: "Krishna Motors", gstin: "27AABCK1234M1Z5", invoice_number: "K1", taxable_value: 1000, cgst: 90, sgst: 90 }),
  )!;
  const xml = vouchersToTallyXml([v], {
    company: "Gujarat Organisors Pvt Ltd",
    ledgerMap: { Purchases: "Purchase A/c - Local", "Krishna Motors": "Krishna Motors (Vadodara)" },
    createMasters: false,
  });
  check("SVCURRENTCOMPANY emitted", xml.includes("<SVCURRENTCOMPANY>Gujarat Organisors Pvt Ltd</SVCURRENTCOMPANY>"));
  check("canonical ledger renamed via map", xml.includes("<LEDGERNAME>Purchase A/c - Local</LEDGERNAME>") && !xml.includes("<LEDGERNAME>Purchases</LEDGERNAME>"));
  check("party renamed via map (header + entry)", xml.includes("<PARTYLEDGERNAME>Krishna Motors (Vadodara)</PARTYLEDGERNAME>"));
  check("no masters emitted when off", !xml.includes("<LEDGER "));
}

// ── Batch: masters deduped across vouchers ───────────────────────────────
console.log("batch dedups shared masters");
{
  const vs: Voucher[] = documentsToVouchers([
    doc({ vendor_name: "Krishna Motors", gstin: "27AABCK1234M1Z5", invoice_number: "K1", taxable_value: 1000, cgst: 90, sgst: 90 }, { id: "d1" }),
    doc({ vendor_name: "Krishna Motors", gstin: "27AABCK1234M1Z5", invoice_number: "K2", taxable_value: 2000, cgst: 180, sgst: 180 }, { id: "d2" }),
  ]);
  const xml = vouchersToTallyXml(vs);
  const purchasesMasters = (xml.match(/<LEDGER NAME="Purchases"/g) ?? []).length;
  const partyMasters = (xml.match(/<LEDGER NAME="Krishna Motors"/g) ?? []).length;
  check("Purchases master emitted once", purchasesMasters === 1, `got ${purchasesMasters}`);
  check("shared party master emitted once", partyMasters === 1, `got ${partyMasters}`);
  const vouchers = (xml.match(/<VOUCHER /g) ?? []).length;
  check("both vouchers emitted", vouchers === 2, `got ${vouchers}`);
  check("distinct REMOTEIDs per doc", xml.includes("ledgeros-d1") && xml.includes("ledgeros-d2"));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
