"use server";

/**
 * Manual client management (add / edit / delete) for the single-user testing
 * phase — the inbox auto-matches against these rows (GSTIN → PAN → domain),
 * so adding a client here is how you teach the matcher. Same client-selection
 * idiom as lib/actions.ts: service-role pre-auth, cookie client once auth is on.
 */

import { revalidatePath } from "next/cache";
import { currentFirmId, serverAdmin, supabaseServer } from "./supabase";
import { DEMO_FIRM_ID } from "./constants";

// Anchored versions of the parser's GSTIN/PAN patterns (india.ts keeps /g
// scanning regexes; .test on those is stateful, so re-declare anchored).
const GSTIN_EXACT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const PAN_EXACT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Free-mail domains never identify a client — don't auto-match on them. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "rediffmail.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

async function mutationClient() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  return authEnabled ? await supabaseServer() : serverAdmin();
}

async function firmId(): Promise<string> {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";
  if (authEnabled) {
    const id = await currentFirmId();
    if (!id) throw new Error("Not signed in to a firm — sign in to continue.");
    return id;
  }
  return DEMO_FIRM_ID;
}

export interface ClientInput {
  id?: string; // present → update, absent → insert
  name: string;
  gstin?: string;
  pan?: string;
  primary_email?: string;
  services?: string[];
}

export type SaveClientResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveClient(input: ClientInput): Promise<SaveClientResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Client name is required." };

  const gstin = input.gstin?.trim().toUpperCase() || null;
  if (gstin && !GSTIN_EXACT.test(gstin)) {
    return { ok: false, error: "That doesn't look like a valid GSTIN (15 chars, e.g. 29ABCDE1234F1Z5)." };
  }

  let pan = input.pan?.trim().toUpperCase() || null;
  if (pan && !PAN_EXACT.test(pan)) {
    return { ok: false, error: "That doesn't look like a valid PAN (10 chars, e.g. ABCDE1234F)." };
  }
  // GSTIN chars 3–12 embed the PAN — derive it when not given, flag a clash.
  if (gstin) {
    const embedded = gstin.slice(2, 12);
    if (!pan) pan = embedded;
    else if (pan !== embedded) {
      return { ok: false, error: `PAN ${pan} doesn't match the PAN inside the GSTIN (${embedded}).` };
    }
  }

  const email = input.primary_email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }
  const domain = email ? email.split("@")[1] : null;
  const primary_domain = domain && !FREE_MAIL.has(domain) ? domain : null;

  const services = (input.services ?? []).filter(Boolean);

  const sb = await mutationClient();
  const row = { name, gstin, pan, primary_email: email, primary_domain, services };

  if (input.id) {
    const { error } = await sb.from("client").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/clients");
    return { ok: true, id: input.id };
  }

  const { data, error } = await sb
    .from("client")
    .insert({ ...row, firm_id: await firmId() })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true, id: data.id as string };
}

/** Documents keep their rows — the FK sets client_id null (back to Unmatched). */
export async function deleteClient(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = await mutationClient();
  const { error } = await sb.from("client").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  revalidatePath("/documents");
  return { ok: true };
}
