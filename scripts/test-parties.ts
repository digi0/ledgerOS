/**
 * Buyer/seller role assignment. The bug this guards: roles were taken from
 * text order, and pdf.js emits DRAW order, so a two-column header can put the
 * "Bill To" block first — swapping the parties and flipping a sale into a
 * purchase in the GSTR-1 bridge.
 *
 * Run: npx tsx scripts/test-parties.ts
 */

import { splitParties } from "../src/lib/parser/extractors/india";
import { invoiceProvider } from "../src/lib/parser/providers/invoice";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const SELLER = "24AAACG0000A1Z0"; // Gujarat
const BUYER = "27AAAAA0002A1Z4"; // Maharashtra

// ── Normal layout: seller letterhead first, then Bill To ──────────────────
console.log("seller letterhead first (the common layout)");
{
  const text = [
    "Ganesh Textiles Pvt Ltd",
    "12 Ring Road, Surat",
    `GSTIN: ${SELLER}`,
    "TAX INVOICE",
    "Invoice No: G/31",
    "Bill To:",
    "Neminath Sarees",
    `GSTIN: ${BUYER}`,
  ].join("\n");

  const p = splitParties(text);
  check("seller gstin", p.seller.gstin === SELLER, `got ${p.seller.gstin}`);
  check("buyer gstin", p.buyer.gstin === BUYER, `got ${p.buyer.gstin}`);
  check("seller name", p.seller.name === "Ganesh Textiles Pvt Ltd", `got ${p.seller.name}`);
  check("buyer name", p.buyer.name === "Neminath Sarees", `got ${p.buyer.name}`);
  check("confident", p.confident === true);
}

// ── The regression: draw order puts the Bill To block FIRST ───────────────
console.log("\nbuyer block emitted first (two-column header, draw order)");
{
  const text = [
    "Bill To:",
    "Neminath Sarees",
    "44 MG Road, Mumbai",
    `GSTIN: ${BUYER}`,
    "Ganesh Textiles Pvt Ltd",
    "12 Ring Road, Surat",
    `GSTIN: ${SELLER}`,
    "TAX INVOICE",
    "Invoice No: G/31",
  ].join("\n");

  const p = splitParties(text);
  check("buyer is NOT read as the seller", p.seller.gstin !== BUYER, `seller=${p.seller.gstin}`);
  check("seller gstin", p.seller.gstin === SELLER, `got ${p.seller.gstin}`);
  check("buyer gstin", p.buyer.gstin === BUYER, `got ${p.buyer.gstin}`);
  check("buyer name", p.buyer.name === "Neminath Sarees", `got ${p.buyer.name}`);
  check("seller name", p.seller.name === "Ganesh Textiles Pvt Ltd", `got ${p.seller.name}`);
  check("confident", p.confident === true);
}

// ── B2C: only the supplier is registered ──────────────────────────────────
console.log("\nB2C — single GSTIN belongs to the supplier");
{
  const text = ["Ganesh Textiles Pvt Ltd", `GSTIN: ${SELLER}`, "TAX INVOICE", "Bill To:", "Walk-in Customer"].join("\n");
  const p = splitParties(text);
  check("seller gstin", p.seller.gstin === SELLER, `got ${p.seller.gstin}`);
  check("no buyer gstin", p.buyer.gstin === null, `got ${p.buyer.gstin}`);
  check("confident", p.confident === true);
}

// ── No labels at all → must admit it guessed ──────────────────────────────
console.log("\nno role labels — must report low confidence, not guess silently");
{
  const text = ["TAX INVOICE", "Invoice No: G/31", `${SELLER}`, `${BUYER}`].join("\n");
  const p = splitParties(text);
  check("flagged unconfident", p.confident === false);
}

// ── End to end through the provider ───────────────────────────────────────
console.log("\ninvoice provider surfaces the split");
{
  const text = [
    "Bill To:",
    "Neminath Sarees",
    `GSTIN: ${BUYER}`,
    "Ganesh Textiles Pvt Ltd",
    `GSTIN: ${SELLER}`,
    "TAX INVOICE",
    "Invoice No: G/31",
    "Taxable Value: 4,51,000.00",
    "CGST 9%: 40,590.00",
    "SGST 9%: 40,590.00",
    "Grand Total: 5,32,180.00",
  ].join("\n");

  const { fields } = invoiceProvider.parse(text);
  check("vendor_name is the seller", fields.vendor_name === "Ganesh Textiles Pvt Ltd", `got ${fields.vendor_name}`);
  check("buyer_name is the buyer", fields.buyer_name === "Neminath Sarees", `got ${fields.buyer_name}`);
  check("gstin is the seller's", fields.gstin === SELLER, `got ${fields.gstin}`);
  check("buyer_gstin is the buyer's", fields.buyer_gstin === BUYER, `got ${fields.buyer_gstin}`);
  check("roles marked confident", fields._party_roles_confident === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
