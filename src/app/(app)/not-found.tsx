import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

/** Branded 404 for the app area. */
export default function AppNotFound() {
  return (
    <div className="fade-up grid min-h-[60vh] place-items-center">
      <div className="card max-w-md p-8 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--color-surface-2)]">
          <Compass className="h-5 w-5 text-[var(--color-fg-muted)]" />
        </span>
        <h1 className="font-display mt-4 text-lg text-[var(--color-ink)]">Page not found</h1>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          The page you&apos;re after doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/"
          className="mx-auto mt-5 inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
