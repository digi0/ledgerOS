"use server";

/**
 * Supabase Auth — email + password. On signup the user joins the demo firm
 * (Sharma & Associates) so the pilot lands in a populated workspace; real
 * "create your own firm" onboarding is a later step. The profile row links
 * auth.users → firm + role, which is what current_firm_id() (and therefore
 * all firm-scoped RLS) reads.
 */

import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase";
import { DEMO_FIRM_ID } from "./constants";

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

  if (!data.session) {
    return {
      error:
        "Account created — check your email to confirm, then sign in. " +
        "(To allow instant signup, turn off email confirmation in Supabase → Authentication → Sign In / Providers → Email.)",
    };
  }

  // Attach the new user to the demo firm (pilot). The cookie client now holds
  // the session, so RLS lets the user write their own profile row.
  const userId = data.user?.id;
  if (userId) {
    await sb
      .from("profiles")
      .upsert(
        { user_id: userId, firm_id: DEMO_FIRM_ID, full_name: fullName, email, role: "member" },
        { onConflict: "user_id" },
      );
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
