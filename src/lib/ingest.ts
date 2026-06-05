"use server";

/**
 * The live ingestion path: upload a document → store in Supabase Storage →
 * run the deterministic accounting-parser → match to a client → insert a
 * `document` row. This is the manual-upload entry; the Gmail connector will
 * call the same parse+match+insert core later.
 */

import { revalidatePath } from "next/cache";
import { parsePdf } from "@/lib/parser";
import type { DocType } from "@/lib/parser";
import { currentFirmId, serverAdmin, supabaseServer } from "./supabase";
import { matchClient } from "./matcher";
import { DEMO_FIRM_ID } from "./constants";
import type { DocumentClassification, DocumentStatus } from "./types";

const DOCTYPE_TO_CLASSIFICATION: Record<DocType, DocumentClassification> = {
  invoice: "invoice",
  bank_statement: "bank_statement",
  tds_certificate: "tds_certificate",
  notice: "notice",
  gst_return: "gst_return",
  receipt: "receipt",
  unknown: "unknown",
};

export type UploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function uploadAndParse(formData: FormData): Promise<UploadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided." };
  }
  if (!/\.pdf$/i.test(file.name)) {
    return { ok: false, error: "Only PDF documents are supported right now." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, error: "File is over 25 MB — split or compress it." };
  }

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  const sb = authEnabled ? await supabaseServer() : serverAdmin();
  const firmId = (authEnabled ? await currentFirmId() : null) ?? DEMO_FIRM_ID;

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 1. store the original in the private bucket (service-role for Storage)
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${firmId}/${Date.now()}-${safeName}`;
  const upload = await serverAdmin().storage.from("documents").upload(path, bytes, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (upload.error) return { ok: false, error: `Storage: ${upload.error.message}` };

  // 2. parse (deterministic, no LLM)
  let parsed = null;
  try {
    parsed = await parsePdf(bytes);
  } catch {
    parsed = null; // unreadable PDF → store as received, staff handles manually
  }

  // 3. match to a client by GSTIN → PAN → domain
  const clientId = parsed ? await matchClient(firmId, parsed.parties) : null;

  const classification: DocumentClassification = parsed
    ? DOCTYPE_TO_CLASSIFICATION[parsed.docType]
    : "unknown";
  const status: DocumentStatus = !parsed ? "received" : clientId ? "matched" : "classified";

  // 4. insert the document row
  const { data, error } = await sb
    .from("document")
    .insert({
      firm_id: firmId,
      client_id: clientId,
      filename: file.name,
      mime_type: file.type || "application/pdf",
      size_bytes: file.size,
      storage_path: path,
      ocr_text: parsed?.rawText.slice(0, 50000) ?? null,
      classification,
      classification_confidence: parsed?.confidence ?? null,
      extracted_fields: parsed?.fields ?? {},
      status,
      handling: "new",
    })
    .select("id")
    .single();

  if (error) {
    // failed insert strands the uploaded file — clean it up
    await serverAdmin().storage.from("documents").remove([path]);
    return { ok: false, error: friendlyDbError(error.message) };
  }

  revalidatePath("/documents");
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

/** Translate raw Postgres/Supabase errors into something a CA can act on. */
function friendlyDbError(msg: string): string {
  if (/row-level security/i.test(msg)) {
    return "Your account isn't linked to a firm — sign out and back in; if it persists, contact support.";
  }
  if (/duplicate key/i.test(msg)) return "This document appears to already exist.";
  if (/violates foreign key/i.test(msg)) return "The selected client no longer exists — refresh and retry.";
  return `Couldn't save the document: ${msg}`;
}
