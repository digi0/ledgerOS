/**
 * Invoice arithmetic + GSTR-1 projection tests. Run:
 *   npx tsx scripts/test-invoice.ts
 */

import { costInvoice, invoiceToGstr1Lines, nextSeq, type InvoiceInput } from "../src/lib/invoice";
import { financialYear, splitGst } from "../src/lib/gst";
import { buildGstr1, summarise } from "../src/lib/export/gstr1";
import type { InvoiceWithLines } from "../src/lib/types";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

console.log("costInvoice — intra-state (CGST + SGST)");
{
  const input: InvoiceInput = {
    supplierState: "24", placeOfSupply: "24",
    lines: [{ description: "Consulting", hsn_sac: "998311", qty: 10, unit: "NOS", rate: 1000, gst_rate: 18 }],
  };
  const c = costInvoice(input);
  check("taxable = 10000", c.taxable === 10000, String(c.taxable));
  check("cgst = 900", c.cgst === 900, String(c.cgst));
  check("sgst = 900", c.sgst === 900, String(c.sgst));
  check("igst = 0", c.igst === 0);
  check("total = 11800", c.total === 11800, String(c.total));
}

console.log("costInvoice — inter-state (IGST)");
{
  const c = costInvoice({
    supplierState: "24", placeOfSupply: "27",
    lines: [{ description: "Goods", qty: 5, rate: 20000, gst_rate: 18 }],
  });
  check("taxable = 100000", c.taxable === 100000, String(c.taxable));
  check("igst = 18000", c.igst === 18000, String(c.igst));
  check("cgst+sgst = 0", c.cgst === 0 && c.sgst === 0);
  check("total = 118000", c.total === 118000, String(c.total));
}

console.log("costInvoice — mixed rates, multiple lines");
{
  const c = costInvoice({
    supplierState: "24", placeOfSupply: "24",
    lines: [
      { description: "Service A", qty: 1, rate: 1000, gst_rate: 18 },
      { description: "Goods B", qty: 2, rate: 500, gst_rate: 12 },
    ],
  });
  check("taxable = 2000", c.taxable === 2000, String(c.taxable));
  // 18% of 1000 = 180 (90+90) ; 12% of 1000 = 120 (60+60)  → cgst = 150
  check("cgst = 150", c.cgst === 150, String(c.cgst));
  check("sgst = 150", c.sgst === 150, String(c.sgst));
  check("total = 2300", c.total === 2300, String(c.total));
}

console.log("financialYear (Apr–Mar)");
{
  check("Jun 2026 → 2026-27", financialYear("2026-06-12") === "2026-27", financialYear("2026-06-12"));
  check("Feb 2026 → 2025-26", financialYear("2026-02-10") === "2025-26", financialYear("2026-02-10"));
  check("Apr 2026 → 2026-27 (FY boundary)", financialYear("2026-04-01") === "2026-27");
  check("Mar 2026 → 2025-26 (FY boundary)", financialYear("2026-03-31") === "2025-26");
}

console.log("nextSeq — per client per FY");
{
  const existing = [{ fy: "2025-26", seq: 7 }, { fy: "2026-27", seq: 3 }, { fy: "2026-27", seq: 5 }];
  check("2026-27 → 6", nextSeq(existing, "2026-27") === 6, String(nextSeq(existing, "2026-27")));
  check("fresh FY → 1", nextSeq(existing, "2027-28") === 1);
}

// Build a persisted-shape invoice for the projection tests.
function inv(over: Partial<InvoiceWithLines> = {}, lines: Partial<InvoiceWithLines["lines"][number]>[] = []): InvoiceWithLines {
  const base: InvoiceWithLines = {
    id: "i1", firm_id: "f", client_id: "c", invoice_no: "INV/2026-27/001", fy: "2026-27", seq: 1,
    date: "2026-06-12", supplier_name: "My Client", supplier_gstin: "24AAACG0000A1Z0", supplier_state: "24",
    supplier_address: null, buyer_name: "Acme Ltd", buyer_gstin: "27AAAAA0001A1Z5", buyer_address: null,
    place_of_supply: "27", reverse_charge: false, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0,
    status: "issued", notes: null, created_at: "", updated_at: "",
    lines: lines.map((l, i) => ({
      id: `l${i}`, invoice_id: "i1", line_no: i + 1, description: "x", hsn_sac: "998311", qty: 1, unit: "NOS",
      rate: 0, taxable: 0, gst_rate: 18, cgst: 0, sgst: 0, igst: 0, cess: 0, ...l,
    })),
    ...over,
  };
  return base;
}

console.log("invoiceToGstr1Lines — single rate → one line");
{
  const lines = invoiceToGstr1Lines(inv({ total: 118000 }, [{ gst_rate: 18, taxable: 100000, hsn_sac: "998311" }]));
  check("one GSTR-1 line", lines.length === 1, String(lines.length));
  check("recipient = buyer GSTIN", lines[0].recipientGstin === "27AAAAA0001A1Z5");
  check("rate 18, taxable 100000", lines[0].rate === 18 && lines[0].taxableValue === 100000);
  check("invoiceValue = full total", lines[0].invoiceValue === 118000);
}

console.log("invoiceToGstr1Lines — multi-rate → one line per rate");
{
  const lines = invoiceToGstr1Lines(
    inv({ total: 2300, place_of_supply: "24" }, [
      { gst_rate: 18, taxable: 1000 },
      { gst_rate: 12, taxable: 1000 },
    ]),
  );
  check("two lines (one per rate)", lines.length === 2, String(lines.length));
  check("both carry same invoice no", lines.every((l) => l.invoiceNo === "INV/2026-27/001"));
}

console.log("multi-rate invoice → GSTR-1 merges into ONE inv with multiple itms");
{
  const lines = invoiceToGstr1Lines(
    inv({ total: 2300, place_of_supply: "24", supplier_state: "24" }, [
      { gst_rate: 18, taxable: 1000 },
      { gst_rate: 12, taxable: 1000 },
    ]),
  );
  const ret = buildGstr1({ supplierGstin: "24AAACG0000A1Z0", period: "2026-06", invoices: lines });
  const group = ret.b2b!.find((g) => g.ctin === "27AAAAA0001A1Z5")!;
  check("one inv entry (not two)", group.inv.length === 1, String(group.inv.length));
  check("that inv has two itms", group.inv[0].itms.length === 2, String(group.inv[0].itms.length));
  check("itm nums are 1 and 2", group.inv[0].itms.map((x) => x.num).join(",") === "1,2");
  const s = summarise(ret);
  check("summary taxable = 2000", s.b2b.taxable === 2000, String(s.b2b.taxable));
  check("invoice counted once", s.b2b.invoices === 1, String(s.b2b.invoices));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
