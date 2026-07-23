"use server";

/**
 * Mutations from the inbox + document detail. During the pre-auth build
 * phase these run through the service-role client (RLS bypass); once auth is
 * on they run through the cookie client and RLS scopes them to the firm.
 * Updates are by document id — the row already carries its firm_id.
 */

import { revalidatePath } from "next/cache";
import { parsePdf } from "@/lib/parser";
import { serverAdmin, supabaseServer } from "./supabase";
import { reparsePatch, type ReparseOutcome } from "./reparse";
import type { DocumentClassification, HandlingStatus } from "./types";

async function mutationClient() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return authEnabled ? await supabaseServer() : serverAdmin();
}

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/documents");
  if (id) revalidatePath(`/documents/${id}`);
}

export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

/** Mark many documents' handling at once (inbox bulk action). */
export async function bulkSetHandling(ids: string[], handling: HandlingStatus): Promise<BulkResult> {
  if (!ids.length) return { ok: false, error: "Nothing selected." };
  const sb = await mutationClient();
  const { error } = await sb.from("document").update({ handling }).in("id", ids);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, count: ids.length };
}

/** Assign (or unassign) a client for many documents at once. */
export async function bulkReassignClient(ids: string[], clientId: string | null): Promise<BulkResult> {
  if (!ids.length) return { ok: false, error: "Nothing selected." };
  const sb = await mutationClient();
  const { error } = await sb
    .from("document")
    .update({ client_id: clientId, status: clientId ? "matched" : "classified" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, count: ids.length };
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

/**
 * Re-run the parser over one already-stored document. Preserves the client
 * assignment, the handling state, and every field a human edited by hand —
 * see lib/reparse.ts for why each of those is off-limits.
 */
export async function reparseDocument(id: string): Promise<ReparseOutcome> {
  const fail = (error: string): ReparseOutcome => ({ id, ok: false, changed: [], preserved: [], error });
  const sb = await mutationClient();

  const { data: doc } = await sb
    .from("document")
    .select("storage_path, extracted_fields")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return fail("Document not found.");
  if (!doc.storage_path) return fail("No stored file to re-parse.");

  const file = await serverAdmin().storage.from("documents").download(doc.storage_path);
  if (file.error || !file.data) return fail(`Storage: ${file.error?.message ?? "download failed"}`);

  let parsed;
  try {
    parsed = await parsePdf(new Uint8Array(await file.data.arrayBuffer()));
  } catch {
    return fail("Could not read this PDF — left unchanged.");
  }

  const previous = (doc.extracted_fields ?? {}) as Record<string, unknown>;
  const patch = reparsePatch(previous, parsed);

  const { error } = await sb
    .from("document")
    .update({
      extracted_fields: patch.extracted_fields,
      classification_confidence: patch.classification_confidence,
      ocr_text: parsed.rawText.slice(0, 50000),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  refresh(id);
  return { id, ok: true, changed: patch.changed, preserved: patch.preserved };
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
  fields._edited = markEdited(fields, k);

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
  // Recorded even though the key is gone: a re-parse must not resurrect a
  // field the CA deliberately deleted.
  fields._edited = markEdited(fields, key);

  const { error } = await sb.from("document").update({ extracted_fields: fields }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

/** Append a key to the manual-override ledger. `_edited` is what stops a
 *  re-parse from overwriting a value a human corrected by hand. */
function markEdited(fields: Record<string, unknown>, key: string): string[] {
  const prev = Array.isArray(fields._edited) ? (fields._edited as string[]) : [];
  return prev.includes(key) ? prev : [...prev, key];
}
