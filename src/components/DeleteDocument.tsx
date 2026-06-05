"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteDocument } from "@/lib/actions";

/** Delete the document (file + row) from the detail page, with one confirm. */
export default function DeleteDocument({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onDelete() {
    start(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) {
        setError(res.error ?? "Delete failed.");
        setConfirming(false);
      } else {
        router.push("/documents");
        router.refresh();
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-[var(--color-fg-muted)]">Delete file + record?</span>
        <button
          onClick={onDelete}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--color-alert)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg-muted)]"
        >
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-alert)] hover:text-[var(--color-alert)]"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
      {error && <p className="text-[11px] text-[var(--color-alert)]">{error}</p>}
    </div>
  );
}
