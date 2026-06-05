"use server";

/**
 * Mutations from the inbox + document detail. During the pre-auth build
 * phase these run through the service-role client (RLS bypass); once auth is
 * on they run through the cookie client and RLS scopes them to the firm.
 * Updates are by document id — the row already carries its firm_id.
 */

import { revalidatePath } from "next/cache";
import { serverAdmin, supabaseServer } from "./supabase";
import type { DocumentClassification, HandlingStatus } from "./types";

async function mutationClient() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return authEnabled ? await supabaseServer() : serverAdmin();
}

function refresh(id?: string) {
  revalidatePath("/");
  if (id) revalidatePath(`/documents/${id}`);
}

export async function setHandling(id: string, handling: HandlingStatus) {
  const sb = await mutationClient();
  const { error } = await sb.from("document").update({ handling }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

export async function reassignClient(id: string, clientId: string | null) {
  const sb = await mutationClient();
  const { error } = await sb
    .from("document")
    .update({ client_id: clientId, status: clientId ? "matched" : "classified" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

export async function reclassify(id: string, classification: DocumentClassification) {
  const sb = await mutationClient();
  const { error } = await sb.from("document").update({ classification }).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

/** Remove the stored PDF and the row. Caller navigates back to the inbox. */
export async function deleteDocument(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await mutationClient();

  // RLS-gated read first — if the caller can't see it, they can't delete it.
  const { data: doc } = await sb.from("document").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  if (doc.storage_path) {
    // Storage deletion via service-role, mirroring getSignedUrl(). Seed rows
    // point at files that were never uploaded — a miss here is fine.
    await serverAdmin().storage.from("documents").remove([doc.storage_path]);
  }

  const { error } = await sb.from("document").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Manual override for one extracted field ("fix field value"). Empty key is
 * rejected; numeric-looking values are stored as numbers so ₹ formatting and
 * the copilot's grounding see the same types the parser writes.
 */
export async function setExtractedField(
  id: string,
  key: string,
  value: string,
): Promise<{ ok: boolean; error?: string }> {
  const k = key.trim();
  if (!k) return { ok: false, error: "Field name is required." };

  const sb = await mutationClient();
  const { data: doc } = await sb
    .from("document")
    .select("extracted_fields")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  const fields = { ...(doc.extracted_fields as Record<string, unknown>) };
  const v = value.trim();
  fields[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;

  const { error } = await sb.from("document").update({ extracted_fields: fields }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

export async function removeExtractedField(
  id: string,
  key: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await mutationClient();
  const { data: doc } = await sb
    .from("document")
    .select("extracted_fields")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  const fields = { ...(doc.extracted_fields as Record<string, unknown>) };
  delete fields[key];

  const { error } = await sb.from("document").update({ extracted_fields: fields }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}
