import { NextRequest, NextResponse } from "next/server";
import { serverAdmin } from "@/lib/supabase";
import { DEMO_FIRM_ID } from "@/lib/constants";
import { parseForm26asText, parseForm26asJson } from "@/lib/form26as";

export async function POST(req: NextRequest) {
  try {
    const form      = await req.formData();
    const file      = form.get("file")     as File   | null;
    const clientId  = form.get("clientId") as string | null;
    const fy        = form.get("fy")       as string | null;

    if (!file || !clientId || !fy) {
      return NextResponse.json(
        { error: "file, clientId and fy are required" },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "json"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only .txt (TRACES download) or .json files are supported" },
        { status: 400 },
      );
    }

    const text = await file.text();
    let entries;

    if (ext === "json") {
      let raw: unknown;
      try { raw = JSON.parse(text); } catch {
        return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
      }
      entries = parseForm26asJson(raw);
    } else {
      entries = parseForm26asText(text);
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No TDS entries found in this file. Make sure this is a TRACES Form 26AS download (.txt) or a structured JSON export." },
        { status: 422 },
      );
    }

    const sb     = serverAdmin();
    const firmId = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" ? null : DEMO_FIRM_ID;

    // Delete existing entries for this client + FY (idempotent re-upload)
    await sb
      .from("form26as_entry")
      .delete()
      .eq("firm_id", firmId)
      .eq("client_id", clientId)
      .eq("fy", fy);

    const rows = entries.map((e) => ({
      firm_id:        firmId,
      client_id:      clientId,
      fy,
      part:           e.part || "A",
      deductor_tan:   e.deductorTan  || null,
      deductor_name:  e.deductorName || null,
      section:        e.section      || null,
      quarter:        e.quarter      || null,
      amount_paid:    e.amountPaid,
      tds_deducted:   e.tdsDeducted,
      booking_status: e.bookingStatus || null,
    }));

    const { error } = await sb.from("form26as_entry").insert(rows);
    if (error) throw error;

    return NextResponse.json({ inserted: rows.length });
  } catch (err) {
    console.error("form26as upload error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
