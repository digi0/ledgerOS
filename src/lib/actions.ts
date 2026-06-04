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
