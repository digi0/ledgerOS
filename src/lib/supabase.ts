/**
 * Supabase clients (server side).
 *
 *   supabaseServer()  — cookie-bound, per-request. Reads the logged-in
 *                       user's session. Subject to RLS, which is firm-scoped
 *                       (a row is visible iff its firm_id = current_firm_id()).
 *                       Use for all firm-scoped reads/writes in server
 *                       components & server actions.
 *   serverAdmin()     — service_role, bypasses RLS. Use ONLY for seed
 *                       scripts and the ingestion pipeline writing rows on
 *                       behalf of a firm (always scope firm_id explicitly).
 *   getSessionUser()  — the current auth user, or null.
 *   requireUserId()   — the current user's id, or throw (use in actions).
 *   currentFirmId()   — the firm_id of the logged-in user, or null.
 *
 * Per-firm model (vs medvault's per-user): staff at a CA firm share access
 * to that firm's clients and documents. The firm link lives in `profiles`.
 */

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cookie-bound server client. Reads/writes the Supabase auth session from
 * the Next cookie store. RLS applies — queries only see the caller firm's rows.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // The proxy (middleware) refreshes the session cookie instead.
        }
      },
    },
  });
}

/** The current authenticated user, or null. */
export async function getSessionUser() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}

/** The current user's id, or throw. Use inside server actions. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated.");
  return user.id;
}

/** The firm_id of the logged-in user (via their profile), or null. */
export async function currentFirmId(): Promise<string | null> {
  const sb = await supabaseServer();
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await sb
    .from("profiles")
    .select("firm_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.firm_id ?? null;
}

/**
 * Service-role client (bypasses RLS). Only for seed scripts and the
 * ingestion pipeline. Never expose to the client; always scope firm_id
 * explicitly when writing.
 */
export function serverAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when Supabase env is configured — lets pages show a setup state. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
