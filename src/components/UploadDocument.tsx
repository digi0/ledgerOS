"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { uploadAndParse } from "@/lib/ingest";

/** Upload a PDF → parse → match → insert. Drives the live ingestion path. */
export default function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadAndParse(fd);
      if (!res.ok) setError(res.error);
      else router.push(`/documents/${res.id}`);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPick} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" /> Upload document
          </>
        )}
      </button>
      {error && <p className="max-w-xs text-right text-[11px] text-[var(--color-alert)]">{error}</p>}
    </div>
  );
}
