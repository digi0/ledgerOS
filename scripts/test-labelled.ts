/**
 * Invoice number + date extraction. The bug this guards: labels were matched
 * unanchored and first-match-wins, so "Due Date", "E-Way Bill Date" and
 * "Original Invoice No" beat the invoice's own fields — and a bare /date/
 * matched inside "updated".
 *
 * Run: npx tsx scripts/test-labelled.ts
 */

import { findInvoiceDate, findInvoiceNumber } from "../src/lib/parser/extractors/india";
import { invoiceProvider } from "../src/lib/parser/providers/invoice";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const REAL_DATE = "2026-04-12";

// ── The six reproduced failures ───────────────────────────────────────────
const dateCases: [string, string, string][] = [
  ["due date must not win",
   "TAX INVOICE\nInvoice No: G/31\nDue Date: 30/05/2026\nInvoice Date: 12/04/2026\n", REAL_DATE],
  ["'date' must not match inside 'updated'",
   "TAX INVOICE\nTerms updated 01/01/2020\nInvoice Date: 12/04/2026\nInvoice No: G/31\n", REAL_DATE],
  ["e-way bill date must not win",
   "TAX INVOICE\nE-Way Bill No: 123 Date: 15/04/2026\nInvoice Date: 12/04/2026\nInvoice No: G/31\n", REAL_DATE],
  ["ISO dates are read",
   "TAX INVOICE\nInvoice Date: 2026-04-12\nInvoice No: G/31\n", REAL_DATE],
  ["delivery date must not win",
   "TAX INVOICE\nDelivery Date: 20/04/2026\nInvoice Date: 12/04/2026\n", REAL_DATE],
  ["day-first stays day-first",
   "TAX INVOICE\nInvoice Date: 03/04/2026\n", "2026-04-03"],
  // The 'TAX INVOICE' heading must not glue to the next line's 'Date:' and
  // outrank the real label further down.
  ["heading must not glue to the next line's label",
   "TAX INVOICE\nDate of Supply: 01/04/2026\nInvoice Date: 12/04/2026\n", REAL_DATE],
];

console.log("invoice date");
for (const [name, text, want] of dateCases) {
  const got = findInvoiceDate(text);
  check(name, got.value === want, `got ${got.value}`);
}

const numberCases: [string, string, string][] = [
  ["flattened text must not swallow the next label",
   "TAX INVOICE Invoice No.:G/31Date:12/04/2026 Taxable 1,000.00\n", "G/31"],
  ["PO number must not win",
   "TAX INVOICE\nPO No: P-9987\nInvoice No: G/31\nInvoice Date: 12/04/2026\n", "G/31"],
  ["credit note uses its own number, not the original",
   "CREDIT NOTE\nOriginal Invoice No: G/31\nInvoice No: CN/7\nInvoice Date: 12/04/2026\n", "CN/7"],
  ["challan number must not win",
   "TAX INVOICE\nChallan No: CH-55\nInvoice No: G/31\n", "G/31"],
  ["tax invoice no outranks bill no",
   "Bill No: B-1\nTax Invoice No: G/31\n", "G/31"],
];

console.log("\ninvoice number");
for (const [name, text, want] of numberCases) {
  const got = findInvoiceNumber(text);
  check(name, got.value === want, `got ${got.value}`);
}

// ── Confidence signalling ────────────────────────────────────────────────
console.log("\nconfidence");
{
  const specific = findInvoiceDate("TAX INVOICE\nInvoice Date: 12/04/2026\n");
  check("specific label ⇒ confident", specific.confident === true);

  const lone = findInvoiceDate("TAX INVOICE\nDate: 12/04/2026\n");
  check("lone bare label ⇒ confident", lone.confident === true, `got ${lone.confident}`);

  const rivals = findInvoiceDate("TAX INVOICE\nDate: 12/04/2026\nDate: 19/09/2026\n");
  check("bare labels that disagree ⇒ unconfident", rivals.confident === false);

  const missing = findInvoiceNumber("TAX INVOICE\nTaxable 1,000.00\n");
  check("nothing found ⇒ null + unconfident", missing.value === null && !missing.confident);
}

// ── End to end ───────────────────────────────────────────────────────────
console.log("\ninvoice provider surfaces both fields");
{
  const text = [
    "Ganesh Textiles Pvt Ltd",
    "GSTIN: 24AAACG0000A1Z0",
    "TAX INVOICE",
    "PO No: P-9987",
    "Due Date: 30/05/2026",
    "Invoice No: G/31",
    "Invoice Date: 12/04/2026",
    "Bill To:",
    "Neminath Sarees",
    "GSTIN: 27AAAAA0002A1Z4",
    "Taxable Value: 4,51,000.00",
    "CGST 9%: 40,590.00",
    "Grand Total: 5,32,180.00",
  ].join("\n");

  const { fields } = invoiceProvider.parse(text);
  check("invoice_number", fields.invoice_number === "G/31", `got ${fields.invoice_number}`);
  check("date is the invoice date, not the due date", fields.date === REAL_DATE, `got ${fields.date}`);
  check("number marked confident", fields._invoice_number_confident === true);
  check("date marked confident", fields._date_confident === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
