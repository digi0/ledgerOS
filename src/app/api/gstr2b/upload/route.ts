import { NextRequest, NextResponse } from "next/server";
import { serverAdmin } from "@/lib/supabase";
import { DEMO_FIRM_ID } from "@/lib/constants";
import { parseGstr2bJson } from "@/lib/gstr2b";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file     = form.get("file") as File | null;
    const clientId = form.get("clientId") as string | null;
    const period   = form.get("period") as string | null;

    if (!file || !clientId || !period) {
      return NextResponse.json({ error: "file, clientId and period are required" }, { status: 400 });
    }
    if (!file.name.endsWith(".json")) {
      return NextResponse.json({ error: "Only .json GSTR-2B exports are supported" }, { status: 400 });
    }

    const text = await file.text();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    const entries = parseGstr2bJson(raw);
    if (entries.length === 0) {
      return NextResponse.json({ error: "No B2B entries found in this GSTR-2B file" }, { status: 422 });
    }

    const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
    const firmId = authEnabled ? null : DEMO_FIRM_ID; // extend with currentFirmId() when auth lands

    const sb = serverAdmin();

    // Delete existing entries for this client+period to allow re-upload
    await sb
      .from("gstr2b_entry")
      .delete()
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .eq("period", period);

    const rows = entries.map((e) => ({
      firm_id:        firmId,
      client_id:      clientId,
      period,
      supplier_gstin: e.supplierGstin,
      supplier_name:  e.supplierName || null,
      invoice_number: e.invoiceNumber,
      invoice_date:   e.invoiceDate || null,
      invoice_value:  e.invoiceValue || null,
      taxable_value:  e.taxableValue || null,
      cgst:           e.cgst,
      sgst:           e.sgst,
      igst:           e.igst,
    }));

    const { error } = await sb.from("gstr2b_entry").insert(rows);
    if (error) throw error;

    return NextResponse.json({ inserted: rows.length });
  } catch (err) {
    console.error("gstr2b upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
