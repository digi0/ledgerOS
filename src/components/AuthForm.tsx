"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, type AuthResult } from "@/lib/auth-actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-[10px] bg-[var(--color-brand)] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

export default function AuthForm({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  const action = mode === "signup" ? signUp : signIn;
  const [state, formAction] = useActionState<AuthResult, FormData>(action, undefined);

  const input =
    "w-full rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-brand)]";

  return (
    <form action={formAction} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && (
        <>
          <input name="fullName" placeholder="Full name" autoComplete="name" className={input} />
          <input name="firmName" placeholder="Firm / practice name" autoComplete="organization" className={input} />
        </>
      )}
      <input
        name="email"
        type="email"
        placeholder="you@firm.in"
        autoComplete="email"
        required
        className={input}
      />
      <input
        name="password"
        type="password"
        placeholder="Password (8+ characters)"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        className={input}
      />
      {state?.error && (
        <p className="rounded-lg bg-[var(--color-alert-soft)] px-3 py-2 text-[12px] text-[var(--color-alert)]">
          {state.error}
        </p>
      )}
      <Submit label={mode === "signup" ? "Create account" : "Sign in"} />
      <p className="pt-1 text-center text-[12px] text-[var(--color-fg-muted)]">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[var(--color-brand)]">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to LedgerOS?{" "}
            <Link href="/signup" className="font-medium text-[var(--color-brand)]">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
