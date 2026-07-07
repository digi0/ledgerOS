/**
 * GSTR-1 adapter tests. Run: npx tsx scripts/test-gstr1.ts
 *
 * The headline test is an ORACLE: an anonymized rebuild of a real filed GSTR-1
 * (Gujarat Organisors, Jan–Mar 2026 — 9 B2B invoices, all intra-Gujarat @18%,
 * HSN 997212). GSTINs/names are fake; the AMOUNTS are the real filed figures,
 * so if buildGstr1 reproduces the return's published summary, the adapter is
 * correct against ground truth. (Real GSTINs/names are never committed.)
 */

import { buildGstr1, summarise, type Gstr1SalesLine } from "../src/lib/export/gstr1";

let passed = 0,
  failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// Anonymized recipients (state 24 = Gujarat preserved; PAN portions fake).
const R = {
  bank1: "24AAAAA0001A1Z5",
  sarees: "24AAAAA0002A1Z4",
  fabrics: "24AAAAA0003A1Z3",
  textile: "24AAAAA0004A1Z2",
  entpr: "24AAAAA0005A1Z1",
  bank2: "24AAAAA0006A1Z0",
  bank3: "24AAAAA0007A1Z9",
};
const HSN = { hsn: "997212", hsnDescription: "Leasing/rental services", uqc: "MTR", rate: 18 as const };
function line(recipientGstin: string, invoiceNo: string, invoiceDate: string, invoiceValue: number, taxableValue: number): Gstr1SalesLine {
  return { recipientGstin, recipientName: "Recipient", invoiceNo, invoiceDate, invoiceValue, taxableValue, pos: "24", ...HSN };
}

// Exact amounts from the real filed return.
const invoices: Gstr1SalesLine[] = [
  line(R.bank1, "G/30", "2026-01-06", 5900, 5000),
  line(R.sarees, "G/31", "2026-01-21", 532180, 451000),
  line(R.fabrics, "G/32", "2026-02-02", 103250, 87500),
  line(R.textile, "G/33", "2026-02-02", 221108, 187380),
  line(R.entpr, "G/34", "2026-02-23", 87339, 74016),
  line(R.bank1, "G/35", "2026-03-20", 5900, 5000),
  line(R.bank1, "G/36", "2026-03-20", 5900, 5000),
  line(R.bank2, "G/37", "2026-03-20", 48144, 40800),
  line(R.bank3, "G/38", "2026-03-20", 36058, 30558),
];

console.log("ORACLE — reproduces the real filed GSTR-1");
{
  const ret = buildGstr1({
    supplierGstin: "24AAACG0000A1Z0",
    period: "2026-01",
    invoices,
    docIssue: { from: "G/30", to: "G/38", totalIssued: 9, cancelled: 0 },
  });
  const s = summarise(ret);

  check("return period fp = MMYYYY", ret.fp === "012026", ret.fp);
  check("b2b recipients = 7 (TJSB appears 3× → one group)", s.b2b.recipients === 7, String(s.b2b.recipients));
  check("b2b invoices = 9", s.b2b.invoices === 9, String(s.b2b.invoices));
  check("total invoice value = 10,45,779", s.b2b.invoiceValue === 1045779, String(s.b2b.invoiceValue));
  check("total taxable = 8,86,254", s.b2b.taxable === 886254, String(s.b2b.taxable));
  check("HSN aggregates to 1 line (same 997212/18%)", s.hsn.count === 1, String(s.hsn.count));
  check("HSN taxable = 8,86,254", s.hsn.taxable === 886254, String(s.hsn.taxable));
  check("HSN CGST = 79,762.86", s.hsn.cgst === 79762.86, String(s.hsn.cgst));
  check("HSN SGST = 79,762.86 (intra-state split)", s.hsn.sgst === 79762.86, String(s.hsn.sgst));
  check("HSN IGST = 0 (no inter-state)", s.hsn.igst === 0, String(s.hsn.igst));
  check("HSN value = 10,45,779", s.hsn.value === 1045779, String(s.hsn.value));

  // shape spot-checks
  const tjsb = ret.b2b!.find((g) => g.ctin === R.bank1)!;
  check("TJSB group has 3 invoices", tjsb.inv.length === 3, String(tjsb.inv.length));
  const g33 = ret.b2b!.flatMap((g) => g.inv).find((i) => i.inum === "G/33")!;
  check("date is DD-MM-YYYY", g33.idt === "02-02-2026", g33.idt);
  check("G/33 CGST = 16,864.20", g33.itms[0].itm_det.camt === 16864.2, String(g33.itms[0].itm_det.camt));
  check("G/33 SGST = 16,864.20", g33.itms[0].itm_det.samt === 16864.2, String(g33.itms[0].itm_det.samt));
  check("G/33 IGST = 0", g33.itms[0].itm_det.iamt === 0);
  check("reverse charge default N", g33.rchrg === "N");
  check("invoice type default R", g33.inv_typ === "R");
  check("doc_issue net = 9", ret.doc_issue!.doc_det[0].docs[0].net_issue === 9);
}

console.log("\ninter-state → IGST");
{
  const ret = buildGstr1({
    supplierGstin: "24AAACG0000A1Z0", // Gujarat supplier
    period: "2026-04",
    invoices: [{ recipientGstin: "27AAAAA0001A1Z5", recipientName: "MH Co", invoiceNo: "S1", invoiceDate: "2026-04-10", invoiceValue: 118000, taxableValue: 100000, pos: "27", rate: 18 }],
  });
  const inv = ret.b2b![0].inv[0].itms[0].itm_det;
  check("IGST = 18,000", inv.iamt === 18000, String(inv.iamt));
  check("CGST = 0", inv.camt === 0);
  check("SGST = 0", inv.samt === 0);
}

console.log("\nB2C small → summarised by pos+rate");
{
  const ret = buildGstr1({
    supplierGstin: "24AAACG0000A1Z0",
    period: "2026-04",
    invoices: [
      { recipientGstin: null, recipientName: "Walk-in", invoiceNo: "C1", invoiceDate: "2026-04-01", invoiceValue: 1180, taxableValue: 1000, pos: "24", rate: 18 },
      { recipientGstin: null, recipientName: "Walk-in", invoiceNo: "C2", invoiceDate: "2026-04-02", invoiceValue: 2360, taxableValue: 2000, pos: "24", rate: 18 },
    ],
  });
  check("no b2b section", !ret.b2b);
  check("one b2cs bucket (same pos+rate)", ret.b2cs!.length === 1, String(ret.b2cs!.length));
  check("b2cs taxable summed = 3000", ret.b2cs![0].txval === 3000, String(ret.b2cs![0].txval));
  check("b2cs CGST = 270 (9% of 3000)", ret.b2cs![0].camt === 270, String(ret.b2cs![0].camt));
  check("b2cs sply_ty INTRA", ret.b2cs![0].sply_ty === "INTRA");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
