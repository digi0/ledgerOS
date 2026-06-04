/**
 * Data access for the Document Inbox. All reads go through the cookie-bound
 * server client, so firm-scoped RLS does the access control for us — these
 * functions never filter by firm_id themselves (the policy does).
 *
 * During the pre-auth phase (NEXT_PUBLIC_AUTH_ENABLED=false) there's no
 * session, so RLS returns zero rows through supabaseServer(). Seed/demo
 * reads can fall back to the service-role client; see listDocuments().
 */

import "server-only";
import { isSupabaseConfigured, serverAdmin, supabaseServer } from "./supabase";
import type { Client, DocumentRow, DocumentClassification, HandlingStatus } from "./types";

/**
 * Read client: cookie-bound (RLS) when auth is on, service-role when off so
 * the seeded demo firm renders during the build phase. The mutation client
 * (lib/actions.ts) mirrors this.
 */
export async function readClient() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return authEnabled ? await supabaseServer() : serverAdmin();
}

const DOC_SELECT =
  "id, firm_id, client_id, source_email_id, filename, mime_type, size_bytes, " +
  "storage_path, ocr_text, classification, classification_confidence, " +
  "extracted_fields, status, handling, error, created_at, updated_at, " +
  "client:client_id (id, name)";

export interface InboxFilters {
  classification?: DocumentClassification;
  handling?: HandlingStatus;
  clientId?: string;
  search?: string;
  limit?: number;
}

/**
 * Returns the firm's documents, newest first, for the inbox list.
 *
 * Auth on  → cookie client, RLS scopes to the caller's firm.
 * Auth off → service-role client (RLS bypass) so the seeded demo firm's
 *            documents render during the build phase.
 */
export async function listDocuments(filters: InboxFilters = {}): Promise<DocumentRow[]> {
  if (!isSupabaseConfigured()) return [];

  const sb = await readClient();

  let q = sb
    .from("document")
    .select(DOC_SELECT)
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.classification) q = q.eq("classification", filters.classification);
  if (filters.handling) q = q.eq("handling", filters.handling);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.search) {
    // free-text over filename + extracted text (websearch syntax)
    q = q.textSearch("fts", filters.search, { type: "websearch", config: "english" });
  }

  const { data, error } = await q;
  if (error) throw new Error(`listDocuments: ${error.message}`);
  return (data ?? []) as unknown as DocumentRow[];
}

export async function getDocument(id: string): Promise<DocumentRow | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = await readClient();

  const { data, error } = await sb.from("document").select(DOC_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(`getDocument: ${error.message}`);
  return (data as unknown as DocumentRow) ?? null;
}

/** Inbox counts by handling status, for the header tabs. */
export async function inboxCounts(): Promise<Record<HandlingStatus, number>> {
  const zero = { new: 0, in_progress: 0, handled: 0 } as Record<HandlingStatus, number>;
  if (!isSupabaseConfigured()) return zero;
  const sb = await readClient();

  const states: HandlingStatus[] = ["new", "in_progress", "handled"];
  await Promise.all(
    states.map(async (s) => {
      const { count } = await sb
        .from("document")
        .select("id", { count: "exact", head: true })
        .eq("handling", s);
      zero[s] = count ?? 0;
    }),
  );
  return zero;
}

/** The firm's clients, for the filter dropdown + reassign control. */
export async function listClients(): Promise<Pick<Client, "id" | "name" | "gstin">[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = await readClient();
  const { data, error } = await sb
    .from("client")
    .select("id, name, gstin")
    .order("name", { ascending: true });
  if (error) throw new Error(`listClients: ${error.message}`);
  return (data ?? []) as Pick<Client, "id" | "name" | "gstin">[];
}

/**
 * Signed URL for a document's file in the private bucket, or null if the
 * object doesn't exist yet (seed rows point at files not yet ingested).
 */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !storagePath) return null;
  const sb = await readClient();
  const { data, error } = await sb.storage.from("documents").createSignedUrl(storagePath, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
