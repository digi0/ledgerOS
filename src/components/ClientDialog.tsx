"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { saveClient, type ClientInput } from "@/lib/client-actions";

/**
 * Add/edit client modal — one form for both (pass `client` with an id to
 * edit; without one it's an add with prefilled values, e.g. "create client
 * from this document"). GSTIN/PAN validated server-side; PAN derives from GSTIN.
 */
export default function ClientDialog({
  client,
  onClose,
  onSaved,
}: {
  client?: ClientInput;
  onClose: () => void;
  onSaved?: (id: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await saveClient({
        id: client?.id,
        name: String(fd.get("name") ?? ""),
        gstin: String(fd.get("gstin") ?? ""),
        pan: String(fd.get("pan") ?? ""),
        primary_email: String(fd.get("primary_email") ?? ""),
      });
      if (!res.ok) setError(res.error);
      else {
        await onSaved?.(res.id);
        router.refresh();
        onClose();
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-brand)]";
  const labelCls =
    "mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-fg-dim)]";

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-[rgba(15,23,42,0.4)] p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <h2 className="font-display text-lg">{client?.id ? "Edit client" : "Add client"}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
          Uploads auto-match to clients by GSTIN, then PAN, then email domain.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="client-name" className={labelCls}>
              Name *
            </label>
            <input
              id="client-name"
              name="name"
              required
              defaultValue={client?.name ?? ""}
              placeholder="Krishna Motors"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="client-gstin" className={labelCls}>
              GSTIN
            </label>
            <input
              id="client-gstin"
              name="gstin"
              defaultValue={client?.gstin ?? ""}
              placeholder="29ABCDE1234F1Z5"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
          <div>
            <label htmlFor="client-pan" className={labelCls}>
              PAN <span className="normal-case">(auto-filled from GSTIN if blank)</span>
            </label>
            <input
              id="client-pan"
              name="pan"
              defaultValue={client?.pan ?? ""}
              placeholder="ABCDE1234F"
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
          <div>
            <label htmlFor="client-email" className={labelCls}>
              Primary email
            </label>
            <input
              id="client-email"
              name="primary_email"
              type="email"
              defaultValue={client?.primary_email ?? ""}
              placeholder="accounts@krishnamotors.in"
              className={inputCls}
            />
          </div>

          {error && <p className="text-[12px] text-[var(--color-alert)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {client?.id ? "Save changes" : "Add client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
