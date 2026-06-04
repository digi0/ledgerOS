import Link from "next/link";
import { MessageSquare } from "lucide-react";

/** Floating Copilot launcher, app-wide (bottom-right), matching the reference. */
export default function CopilotFab() {
  return (
    <Link
      href="/copilot"
      aria-label="Open AI Copilot"
      className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand)] text-white shadow-lg shadow-[rgba(15,23,42,0.25)] hover:bg-[var(--color-brand-strong)]"
    >
      <MessageSquare className="h-5 w-5" />
    </Link>
  );
}
