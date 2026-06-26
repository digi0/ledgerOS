"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileJson } from "lucide-react";

interface Props {
  clientId: string;
  period: string;
  hasExisting: boolean;
}

export default function Gstr2bUpload({ clientId, period, hasExisting }: Props) {
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.name.endsWith(".json")) {
      setMessage("Only .json files exported from the GST portal are accepted.");
      setState("error");
      return;
    }

    setState("uploading");
    setMessage("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("clientId", clientId);
    fd.append("period", period);

    const res = await fetch("/api/gstr2b/upload", { method: "POST", body: fd });
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

  return (
    <div className="card flex flex-col items-center gap-4 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-brand-soft)]">
        <FileJson className="h-6 w-6 text-[var(--color-brand)]" />
      </div>

      <div>
        <p className="text-[14px] font-semibold text-[var(--color-ink)]">
          {hasExisting ? "Re-upload GSTR-2B" : "Upload GSTR-2B for this period"}
        </p>
        <p className="mt-1 max-w-sm text-[13px] text-[var(--color-fg-muted)]">
          Download the GSTR-2B JSON from the GST portal → File Returns → GSTR-2B → Download
          JSON. Drop it here to run reconciliation.
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
        accept=".json"
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
        {state === "uploading" ? "Importing…" : "Choose JSON file"}
      </button>
    </div>
  );
}
