"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { uploadAndParse } from "@/lib/ingest";

interface FileStatus {
  name: string;
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
  docId?: string;
}

/**
 * Upload PDFs → parse → match → insert. Multi-file, sequential (each upload
 * runs the parser), with per-file status. Dropping files anywhere on the
 * page works too.
 */
export default function UploadDocument() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragging, setDragging] = useState(false);

  const process = useCallback(
    (picked: File[]) => {
      if (picked.length === 0 || pending) return;
      const initial: FileStatus[] = picked.map((f) => ({ name: f.name, state: "queued" }));
      setFiles(initial);

      start(async () => {
        const results = [...initial];
        for (let i = 0; i < picked.length; i++) {
          results[i] = { ...results[i], state: "uploading" };
          setFiles([...results]);
          const fd = new FormData();
          fd.set("file", picked[i]);
          try {
            const res = await uploadAndParse(fd);
            results[i] = res.ok
              ? { ...results[i], state: "done", docId: res.id }
              : { ...results[i], state: "error", error: res.error };
          } catch {
            results[i] = { ...results[i], state: "error", error: "Upload failed — try again." };
          }
          setFiles([...results]);
        }
        router.refresh();
        // single successful upload → jump straight to the document
        const done = results.filter((r) => r.state === "done");
        if (done.length === 1 && results.length === 1) router.push(`/documents/${done[0].docId}`);
      });
    },
    [pending, router, start],
  );

  // page-wide drag-and-drop
  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      depth++;
      setDragging(true);
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const dropped = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        /\.pdf$/i.test(f.name),
      );
      if (dropped.length) process(dropped);
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [process]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    process(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  }

  const active = files.filter((f) => f.state === "uploading" || f.state === "queued").length;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={onPick}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing {active > 1 ? `(${active} left)` : "…"}
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" /> Upload documents
          </>
        )}
      </button>

      {/* per-file results */}
      {files.length > 0 && (
        <div className="max-w-sm space-y-0.5 text-right">
          {files.map((f) => (
            <p key={f.name} className="flex items-center justify-end gap-1.5 text-[11px]">
              {f.state === "done" && <CheckCircle2 className="h-3 w-3 text-[var(--color-ok)]" />}
              {f.state === "error" && <XCircle className="h-3 w-3 text-[var(--color-alert)]" />}
              {f.state === "uploading" && (
                <Loader2 className="h-3 w-3 animate-spin text-[var(--color-fg-dim)]" />
              )}
              <span
                className={
                  f.state === "error"
                    ? "text-[var(--color-alert)]"
                    : "text-[var(--color-fg-muted)]"
                }
              >
                {f.name}
                {f.error ? ` — ${f.error}` : ""}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.45)]">
          <div className="rounded-2xl border-2 border-dashed border-white/70 bg-[var(--color-surface)] px-10 py-8 text-center shadow-xl">
            <UploadCloud className="mx-auto h-8 w-8 text-[var(--color-brand)]" />
            <p className="mt-2 text-[14px] font-medium text-[var(--color-ink)]">
              Drop PDFs to upload
            </p>
            <p className="text-[12px] text-[var(--color-fg-muted)]">
              parsed &amp; matched automatically
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
