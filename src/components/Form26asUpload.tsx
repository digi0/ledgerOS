"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSearch } from "lucide-react";

interface Props {
  clientId: string;
  fy: string;
  hasExisting: boolean;
}

export default function Form26asUpload({ clientId, fy, hasExisting }: Props) {
  const [state, setState]     = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);
  const router                = useRouter();

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "json"].includes(ext ?? "")) {
      setMessage("Only .txt (TRACES download) or .json files are supported.");
      setState("error");
      return;
    }

    setState("uploading");
    setMessage("");

    const fd = new FormData();
    fd.append("file",     file);
    fd.append("clientId", clientId);
    fd.append("fy",       fy);

    const res  = await fetch("/api/form26as/upload", { method: "POST", body: fd });
    const json = (await res.json()) as { inserted?: number; error?: string };

    if (!res.ok) {
      setState("error");
      setMessage(json.error ?? "Upload failed");
      return;
    }

    setState("done");
    setMessage(`${json.inserted} entries imported`);
    setTimeout(() => router.refresh(), 800);
  }

  if (hasExisting) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={state === "uploading"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {state === "uploading" ? "Importing…" : state === "done" ? message : "Re-upload 26AS"}
        </button>
      </>
    );
  }

  return (
    <div className="card flex flex-col items-center gap-4 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-brand-soft)]">
        <FileSearch className="h-6 w-6 text-[var(--color-brand)]" />
      </div>

      <div>
        <p className="text-[14px] font-semibold text-[var(--color-ink)]">
          Upload Form 26AS for {fy}
        </p>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--color-fg-muted)]">
          Download from TRACES portal → Login → Annual Tax Statement (26AS) → Download → Text
          (.txt). Drop it here to run reconciliation.
        </p>
      </div>

      {state === "error" && (
        <p className="text-[13px] text-[var(--color-alert)]">{message}</p>
      )}
      {state === "done" && (
        <p className="text-[13px] text-[var(--color-ok)]">{message} — refreshing…</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={state === "uploading"}
        className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {state === "uploading" ? "Importing…" : "Choose 26AS file"}
      </button>
    </div>
  );
}
