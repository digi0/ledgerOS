"use client";

import { useEffect } from "react";
import { TriangleAlert, RotateCw } from "lucide-react";

/** Branded error boundary for the app area — replaces Next's default red
 *  overlay with something calm and recoverable. `reset()` re-renders the
 *  segment (retries the failed server render). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for debugging; a real logger (Sentry etc.) hooks in here later.
    console.error(error);
  }, [error]);

  return (
    <div className="fade-up grid min-h-[60vh] place-items-center">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--color-alert-soft)]">
          <TriangleAlert className="h-5 w-5 text-[var(--color-alert)]" />
        </span>
        <h1 className="font-display mt-4 text-lg text-[var(--color-ink)]">Something went wrong</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          This screen hit an error while loading. It&apos;s usually temporary — try again.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-[var(--color-fg-dim)]">Ref: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="btn-glass mx-auto mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
        >
          <RotateCw className="h-4 w-4" /> Try again
        </button>
      </div>
    </div>
  );
}
