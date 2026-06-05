/* Quick deterministic check: feed representative Indian document text and
   assert the classifier + extractors behave. Run: npm test (uses tsx). */
import { parseText } from "../src/lib/parser/index";

const SAMPLES: { name: string; text: string; expect: string }[] = [
  {
    name: "GST tax invoice",
    expect: "invoice",
    text: `Patel Textiles Pvt Ltd
TAX INVOICE
GSTIN: 24ABCDE1234F1Z5
Invoice No: INV-4471   Invoice Date: 28/05/2026
HSN: 5208  Cotton fabric
Taxable Value: 1,25,000.00
CGST 9%: 11,250.00
SGST 9%: 11,250.00
Grand Total: ₹1,47,500.00`,
  },
  {
    name: "Bank statement",
    expect: "bank_statement",
    text: `HDFC Bank
Statement of Account
A/c No: XXXXXX4821   IFSC: HDFC0001234
Statement Period: 01/04/2026 to 30/04/2026
Opening Balance: 7,50,000.00
Closing Balance: 8,42,310.00`,
  },
  {
    name: "TDS Form 16A",
    expect: "tds_certificate",
    text: `FORM NO. 16A
Certificate under section 203 of the Income-tax Act
Deductor: Acme Corp   Deductee: Verma Tech Solutions
PAN of deductee: VWXYZ3456T
Section: 194J   Quarter: Q4
Amount paid/credited: 1,87,500.00
Amount of tax deposited: 18,750.00`,
  },
  {
    name: "GST ASMT-10 notice",
    expect: "notice",
    text: `Form GST ASMT-10
Notice for intimating discrepancies in the return
GSTIN: 29KLMNO9012P1Z8
Subject: ITC mismatch FY 2024-25
Tax due / demand: 63,400.00
Due date to reply: 18/06/2026`,
  },
  {
    name: "Income Tax 143(1) intimation",
    expect: "notice",
    text: `INCOME TAX DEPARTMENT
Intimation u/s 143(1)
PAN: AKRPK4582M   A.Y. 2025-26
Refund determined: 12,480.00`,
  },
  {
    name: "Receipt",
    expect: "receipt",
    text: `Blue Dart Courier
RECEIPT
Received with thanks
Date: 29/05/2026
Amount: ₹540.00`,
  },
  {
    // Anonymized copy of a real GST-portal GSTR-3B download (flattened text,
    // uncomma'd decimals) — the layout that exposed the invoice misclassification.
    name: "GSTR-3B filed return",
    expect: "gst_return",
    text: `Form GSTR-3B [See rule 61(5)] Year 2026-27 Period April GSTIN of the supplier 06ABCDE1234F1Z5 2(a). Legal name of the registered person SUNITA SHARMA 2(b). Trade name, if any S. K. TRADING CO. 2(c). ARN AA0604261234567 2(d). Date of ARN 21/05/2026 (Amount in ₹ for all tables) 3.1 Details of Outward supplies and inward supplies liable to reverse charge Nature of Supplies Total taxable value Integrated tax Central tax State/UT tax Cess (a) Outward taxable supplies (other than zero rated, nil rated and exempted) 7241290.50 295990.48 505257.67 505257.67 0.00 (b) Outward taxable supplies (zero rated) 0.00 0.00 - - 0.00 4. Eligible ITC Details Integrated tax Central tax State/UT tax Cess A. ITC Available (1) Import of goods 0.00 0.00 0.00 0.00 FILED (5) All other ITC 587868.94 270722.53 270722.53 0.00 C. Net ITC available (A-B) 588029.04 271077.53 271077.53 0.00 6.1 Payment of tax`,
  },
];

let pass = 0;
for (const s of SAMPLES) {
  const d = parseText(s.text);
  const ok = d.docType === s.expect;
  pass += ok ? 1 : 0;
  console.log(
    `${ok ? "✓" : "✗"} ${s.name.padEnd(28)} → ${d.docType} (${d.provider}, ${(d.confidence * 100) | 0}%)`,
  );
  console.log(`    fields: ${JSON.stringify(d.fields)}`);
  if (d.parties.gstins.length) console.log(`    gstins: ${d.parties.gstins.join(", ")}`);
}
console.log(`\n${pass}/${SAMPLES.length} classified as expected`);
if (pass !== SAMPLES.length) process.exit(1);
