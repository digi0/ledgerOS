"use server";

/**
 * Supabase Auth — email + password. The profile row (auth user → firm + role,
 * what current_firm_id() and all firm-scoped RLS read) is created by a DB
 * trigger on auth.users (migration 0003), so it exists no matter which
 * confirmation flow the signup took. New users join the demo firm
 * (Sharma & Associates); real "create your own firm" onboarding is later.
 */

import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase";

export type AuthResult = { error: string } | undefined;

function validate(email: string, password: string): string | null {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Enter a valid email address.";
  if (!password || password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export async function signUp(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim() || email.split("@")[0];

  const invalid = validate(email, password);
  if (invalid) return { error: invalid };

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };

  // Profile creation happens in the DB trigger — nothing to do here. The old
  // app-side upsert only ran when signup returned an instant session, which
  // silently skipped users who signed up while email confirmation was on.
  if (!data.session) {
    return {
      error: "Account created — check your email to confirm, then sign in.",
    };
  }

  redirect("/");
}

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/") || "/";

  if (!email || !password) return { error: "Email and password are required." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(next.startsWith("/") ? next : "/");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}
