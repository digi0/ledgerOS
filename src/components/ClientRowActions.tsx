"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { deleteClient, type ClientInput } from "@/lib/client-actions";
import ClientDialog from "./ClientDialog";

/** Edit / delete controls on a client row. Delete asks once, inline. */
export default function ClientRowActions({
  client,
}: {
  client: ClientInput & { id: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function onDelete() {
    start(async () => {
      const res = await deleteClient(client.id);
      if (res.ok) router.refresh();
      setConfirming(false);
    });
  }

  const iconBtn =
    "rounded-lg border border-[var(--color-border)] p-1.5 text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)] disabled:opacity-50";

  return (
    <div className="inline-flex items-center gap-1.5">
      {confirming ? (
        <>
          <span className="text-[12px] text-[var(--color-fg-muted)]">
            Delete? Documents go back to Unmatched.
          </span>
          <button
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-alert)] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin" />} Delete
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-fg-muted)]"
          >
            Keep
          </button>
        </>
      ) : (
        <>
          <button onClick={() => setEditing(true)} aria-label="Edit client" className={iconBtn}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setConfirming(true)}
            aria-label="Delete client"
            className={iconBtn}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {editing && <ClientDialog client={client} onClose={() => setEditing(false)} />}
    </div>
  );
}
