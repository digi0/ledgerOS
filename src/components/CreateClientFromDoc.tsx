"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { reassignClient } from "@/lib/actions";
import type { ClientInput } from "@/lib/client-actions";
import ClientDialog from "./ClientDialog";

/**
 * The missing workflow link for unmatched documents: the parser already
 * extracted who this is (legal/trade name, GSTIN) — one click turns that
 * into a client and assigns the document. Future uploads from the same
 * GSTIN then auto-match.
 */
export default function CreateClientFromDoc({
  docId,
  suggestion,
}: {
  docId: string;
  suggestion: ClientInput;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-3 py-2.5 text-left hover:border-[var(--color-brand)]"
      >
        <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-brand-strong)]" />
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-[var(--color-ink)]">
            Create client &ldquo;{suggestion.name}&rdquo;
          </span>
          <span className="block text-[11px] text-[var(--color-fg-dim)]">
            from this document&apos;s parsed fields — future uploads auto-match
          </span>
        </span>
      </button>
      {open && (
        <ClientDialog
          client={suggestion}
          onClose={() => setOpen(false)}
          onSaved={(id) =>
            new Promise<void>((resolve) =>
              start(async () => {
                await reassignClient(docId, id);
                resolve();
              }),
            )
          }
        />
      )}
    </>
  );
}
