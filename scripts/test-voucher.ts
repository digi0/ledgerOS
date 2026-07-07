/**
 * Canonical voucher + CSV serializer tests. No DB — pure functions only.
 * Run: npx tsx scripts/test-voucher.ts
 */

import type { DocumentRow } from "../src/lib/types";
import { documentToVoucher, documentsToVouchers, imbalance } from "../src/lib/voucher";
import { vouchersToCsv } from "../src/lib/export/csv";

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

// ── Intra-state invoice (CGST + SGST) ────────────────────────────────────
console.log("intra-state purchase invoice");
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
  check("derives a voucher", !!v);
  check("kind = purchase", v.kind === "purchase");
  check("balanced (Σ = 0)", imbalance(v.lines) === 0, `imbalance=${imbalance(v.lines)}`);
  check("party is the vendor", v.party?.name === "Krishna Motors");
  check("reference is the invoice no", v.reference === "KM/2026/0142");
  check("no round-off line needed", !v.lines.some((l) => l.ledger === "Round Off"));
  check("no warnings", v.warnings.length === 0, v.warnings.join("; "));
  const party = v.lines.find((l) => l.ledger === "Krishna Motors")!;
  check("party credited full 11800", party.amount === -11800, `got ${party.amount}`);
  check("no IGST line", !v.lines.some((l) => l.ledger === "Input IGST"));
}

// ── Inter-state invoice (IGST) ───────────────────────────────────────────
console.log("inter-state purchase invoice (IGST)");
{
  const v = documentToVoucher(
    doc({
      vendor_name: "Chennai Steel Co",
      gstin: "33AABCC9999Q1Z2",
      invoice_number: "CS-88",
      date: "2026-06-20",
      taxable_value: 50000,
      igst: 9000,
      total: 59000,
    }),
  )!;
  check("balanced", imbalance(v.lines) === 0);
  check("has IGST line 9000", v.lines.some((l) => l.ledger === "Input IGST" && l.amount === 9000));
  check("no CGST/SGST lines", !v.lines.some((l) => /Input [CS]GST/.test(l.ledger)));
}

// ── Total disagrees with taxable+GST → warns, still balances ─────────────
console.log("mismatched total → warns but balances");
{
  const v = documentToVoucher(
    doc({
      vendor_name: "Odd Traders",
      gstin: "27AAAAA0000A1Z5",
      invoice_number: "OT-1",
      taxable_value: 1000,
      cgst: 90,
      sgst: 90,
      total: 1500, // wrong — real is 1180
    }),
  )!;
  check("still balanced", imbalance(v.lines) === 0);
  check("raises a mismatch warning", v.warnings.some((w) => /disagrees/.test(w)));
  check(
    "party credited the DERIVED total, not the wrong 1500",
    v.lines.find((l) => l.ledger === "Odd Traders")!.amount === -1180,
  );
}

// ── Rounding gap within tolerance → round-off line ───────────────────────
console.log("paise rounding → round-off line");
{
  const v = documentToVoucher(
    doc({ vendor_name: "Paise Co", gstin: "27AAAAA0000A1Z5", invoice_number: "P1", taxable_value: 100.005, cgst: 9, sgst: 9 }),
  )!;
  check("balanced after round-off", imbalance(v.lines) === 0);
}

// ── Non-invoice document → no voucher ────────────────────────────────────
console.log("non-invoice → skipped");
{
  const v = documentToVoucher(doc({}, { classification: "bank_statement" }));
  check("returns null for bank_statement", v === null);
}

// ── Missing fields → warnings, no crash ──────────────────────────────────
console.log("empty invoice → warnings, no crash");
{
  const v = documentToVoucher(doc({}))!;
  check("still returns a voucher", !!v);
  check("warns about missing amounts", v.warnings.some((w) => /No amounts/.test(w)));
  check("warns about missing GSTIN", v.warnings.some((w) => /GSTIN/.test(w)));
  check("falls back to created_at date", v.date === "2026-06-30");
}

// ── CSV serializer ───────────────────────────────────────────────────────
console.log("CSV serializer");
{
  const vouchers = documentsToVouchers([
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
    doc({ vendor_name: 'A "Quoted, Vendor"', gstin: "27AAAAA0000A1Z5", invoice_number: "Q1", taxable_value: 100 }, { id: "doc-2" }),
  ]);
  const csv = vouchersToCsv(vouchers);
  const lines = csv.split("\r\n");
  check("has header row", lines[0].startsWith("Date,Voucher Type,"));
  check("dd/mm/yyyy dates", csv.includes("12/06/2026"));
  check("debit and credit split into separate columns", csv.includes(",10000.00,,") || csv.includes("10000.00,"));
  check("escapes commas/quotes in vendor name", csv.includes('"A ""Quoted, Vendor"""'));
  check(
    "one row per ledger line (4 lines voucher 1 + party etc.)",
    lines.length > 5,
    `got ${lines.length} rows`,
  );
  // Every voucher's debit total must equal its credit total in the sheet.
  // Proper RFC-4180 row parse — the vendor name legitimately contains a comma.
  const parseRow = (row: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (inQ) {
        if (c === '"' && row[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  let dr = 0,
    cr = 0;
  for (const row of lines.slice(1)) {
    const cols = parseRow(row);
    dr += parseFloat(cols[6]) || 0;
    cr += parseFloat(cols[7]) || 0;
  }
  check("total debits = total credits in the CSV", Math.abs(dr - cr) < 0.01, `dr=${dr} cr=${cr}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
