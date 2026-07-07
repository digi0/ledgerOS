"use server";

/**
 * Raise an invoice for a client. The client is the SUPPLIER; we snapshot their
 * details, cost every line deterministically (lib/invoice), assign the next
 * per-FY serial, and write the invoice + its lines. The stored numbers feed the
 * outward register + GSTR-1 with no re-extraction.
 */

import { revalidatePath } from "next/cache";
import { currentFirmId, serverAdmin, supabaseServer } from "./supabase";
import { DEMO_FIRM_ID } from "./constants";
import { getClient, listInvoices } from "./db";
import { costInvoice, nextSeq, type LineInput } from "./invoice";
import { financialYear, stateCode } from "./gst";

const GSTIN_EXACT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

async function mutationClient() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return authEnabled ? await supabaseServer() : serverAdmin();
}
async function firmId(): Promise<string> {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return (authEnabled ? await currentFirmId() : null) ?? DEMO_FIRM_ID;
}

export interface CreateInvoiceInput {
  clientId: string;
  date: string; // ISO
  invoiceNo?: string; // optional override; auto-assigned when blank
  buyerName: string;
  buyerGstin?: string; // blank ⇒ B2C
  buyerAddress?: string;
  placeOfSupply?: string; // 2-digit; defaults to buyer's state, else supplier's
  reverseCharge?: boolean;
  notes?: string;
  lines: LineInput[];
}

export type CreateInvoiceResult = { ok: true; id: string; invoiceNo: string } | { ok: false; error: string };

export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "Client not found." };

  const supplierGstin = client.gstin;
  if (!supplierGstin) {
    return { ok: false, error: `${client.name} has no GSTIN — add one before raising a GST tax invoice.` };
  }
  const supplierState = stateCode(supplierGstin)!;

  const date = input.date?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "A valid invoice date is required." };

  const buyerName = input.buyerName?.trim();
  if (!buyerName) return { ok: false, error: "Buyer name is required." };

  const buyerGstin = input.buyerGstin?.trim().toUpperCase() || null;
  if (buyerGstin && !GSTIN_EXACT.test(buyerGstin)) {
    return { ok: false, error: "Buyer GSTIN doesn't look valid (15 chars, e.g. 27ABCDE1234F1Z5)." };
  }

  const pos = (input.placeOfSupply?.trim() || (buyerGstin ? stateCode(buyerGstin) : null) || supplierState).padStart(2, "0");

  const lines = (input.lines ?? []).filter((l) => l.description?.trim());
  if (lines.length === 0) return { ok: false, error: "Add at least one line item." };
  for (const l of lines) {
    if (!(l.qty > 0)) return { ok: false, error: `"${l.description}" needs a quantity greater than 0.` };
    if (l.rate < 0 || l.gst_rate < 0) return { ok: false, error: `"${l.description}" has a negative amount.` };
  }

  const costed = costInvoice({ supplierState, placeOfSupply: pos, lines });
  const fy = financialYear(date);

  const sb = await mutationClient();

  // Serial: next per (client, FY). Retry once on a unique-collision race.
  const existing = await listInvoices(input.clientId);
  let seq = nextSeq(existing.map((i) => ({ fy: i.fy, seq: i.seq })), fy);

  const buildNo = (n: number) => input.invoiceNo?.trim() || `INV/${fy}/${String(n).padStart(3, "0")}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const invoiceNo = buildNo(seq);
    const { data, error } = await sb
      .from("invoice")
      .insert({
        firm_id: await firmId(),
        client_id: input.clientId,
        invoice_no: invoiceNo,
        fy,
        seq,
        date,
        supplier_name: client.name,
        supplier_gstin: supplierGstin,
        supplier_state: supplierState,
        supplier_address: null,
        buyer_name: buyerName,
        buyer_gstin: buyerGstin,
        buyer_address: input.buyerAddress?.trim() || null,
        place_of_supply: pos,
        reverse_charge: !!input.reverseCharge,
        taxable: costed.taxable,
        cgst: costed.cgst,
        sgst: costed.sgst,
        igst: costed.igst,
        cess: costed.cess,
        total: costed.total,
        status: "issued",
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      const lineRows = costed.lines.map((l, i) => ({
        invoice_id: data.id,
        line_no: i + 1,
        description: l.description.trim(),
        hsn_sac: l.hsn_sac?.trim() || null,
        qty: l.qty,
        unit: l.unit?.trim() || null,
        rate: l.rate,
        taxable: l.taxable,
        gst_rate: l.gst_rate,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        cess: l.cess,
      }));
      const { error: lineErr } = await sb.from("invoice_line").insert(lineRows);
      if (lineErr) {
        await sb.from("invoice").delete().eq("id", data.id); // don't leave a header with no lines
        return { ok: false, error: `Could not save line items: ${lineErr.message}` };
      }
      revalidatePath(`/clients/${input.clientId}`);
      revalidatePath("/invoices");
      return { ok: true, id: data.id, invoiceNo };
    }

    // 23505 = unique_violation (serial race or manual duplicate) → bump and retry.
    if (error?.code === "23505" && !input.invoiceNo) { seq += 1; continue; }
    return { ok: false, error: error?.message ?? "Could not create the invoice." };
  }
  return { ok: false, error: "Could not assign a unique invoice number — try again." };
}
