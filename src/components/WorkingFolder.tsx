"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, RefreshCw, FileText, CheckCircle2, XCircle, Loader2, FolderSync } from "lucide-react";
import { uploadAndParse } from "@/lib/ingest";

/**
 * Working folder — the CA designates a local folder once (via the File System
 * Access API); LedgerOS remembers it (IndexedDB) and lists its PDFs so
 * documents can be pulled straight into the inbox, no per-file OS picker. The
 * folder feeds the SAME parse pipeline as a manual upload. Single-file upload
 * (UploadDocument) stays as the always-available fallback.
 *
 * Chromium-only (Chrome / Edge / Brave). Where the API is missing we hide this
 * and the manual upload button remains.
 */

// --- File System Access API shims (not in every TS lib.dom) ---------------
type PermDesc = { mode?: "read" | "readwrite" };
type Permable = {
  queryPermission?(d: PermDesc): Promise<PermissionState>;
  requestPermission?(d: PermDesc): Promise<PermissionState>;
};
type DirHandle = FileSystemDirectoryHandle & Permable;
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<DirHandle>;
  }
}

// --- IndexedDB: persist the directory handle across sessions --------------
const DB = "ledgeros-fs", STORE = "handles", KEY = "workingDir";
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(handle: DirHandle) {
  const db = await openDb();
  await new Promise((res, rej) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(handle, KEY);
    t.oncomplete = () => res(null);
    t.onerror = () => rej(t.error);
  });
}
async function idbGet(): Promise<DirHandle | null> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, "readonly");
    const rq = t.objectStore(STORE).get(KEY);
    rq.onsuccess = () => res((rq.result as DirHandle) ?? null);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbClear() {
  const db = await openDb();
  await new Promise((res) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).delete(KEY);
    t.oncomplete = () => res(null);
  });
}

async function* filesIn(dir: DirHandle): AsyncGenerator<FileSystemFileHandle> {
  const it = (dir as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values();
  for await (const entry of it) if (entry.kind === "file") yield entry as FileSystemFileHandle;
}

type State = "idle" | "ingesting" | "done" | "error";
interface Item { name: string; handle: FileSystemFileHandle; state: State; error?: string }

export default function WorkingFolder() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [dir, setDir] = useState<DirHandle | null>(null);
  const [dirName, setDirName] = useState<string>("");
  const [needsPermission, setNeedsPermission] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const listFiles = useCallback(async (handle: DirHandle) => {
    const out: Item[] = [];
    for await (const fh of filesIn(handle)) {
      if (/\.pdf$/i.test(fh.name)) out.push({ name: fh.name, handle: fh, state: "idle" });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    setItems(out);
  }, []);

  // Restore a previously-set folder on mount.
  useEffect(() => {
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) return;
    setSupported(true);
    (async () => {
      const saved = await idbGet().catch(() => null);
      if (!saved) return;
      setDirName(saved.name);
      const perm = (await saved.queryPermission?.({ mode: "read" })) ?? "prompt";
      if (perm === "granted") { setDir(saved); await listFiles(saved); }
      else setNeedsPermission(true);
    })();
  }, [listFiles]);

  async function pickFolder() {
    try {
      const handle = await window.showDirectoryPicker?.({ mode: "read" });
      if (!handle) return;
      await idbPut(handle);
      setDir(handle);
      setDirName(handle.name);
      setNeedsPermission(false);
      await listFiles(handle);
    } catch {
      /* user dismissed the picker */
    }
  }

  async function reconnect() {
    const saved = await idbGet().catch(() => null);
    if (!saved) return;
    const perm = (await saved.requestPermission?.({ mode: "read" })) ?? "denied";
    if (perm === "granted") { setDir(saved); setNeedsPermission(false); await listFiles(saved); }
  }

  async function changeFolder() {
    await idbClear();
    setDir(null); setDirName(""); setItems([]); setNeedsPermission(false);
    await pickFolder();
  }

  const setItem = (name: string, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x) => (x.name === name ? { ...x, ...patch } : x)));

  async function ingest(item: Item) {
    setItem(item.name, { state: "ingesting", error: undefined });
    try {
      const file = await item.handle.getFile();
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAndParse(fd);
      setItem(item.name, res.ok ? { state: "done" } : { state: "error", error: res.error });
    } catch {
      setItem(item.name, { state: "error", error: "Couldn't read or ingest this file." });
    }
  }

  async function ingestAll() {
    setBusy(true);
    for (const item of items) if (item.state !== "done" && item.state !== "ingesting") await ingest(item);
    setBusy(false);
    router.refresh();
  }

  if (!supported) return null;

  const pending = items.filter((i) => i.state !== "done").length;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-[var(--color-brand)]" />
          <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Working folder</h3>
          {dir && <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-fg-muted)]">{dirName}</span>}
        </div>
        <div className="flex items-center gap-2">
          {dir && (
            <>
              <button onClick={() => dir && listFiles(dir)} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]">
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
              <button onClick={changeFolder} className="text-[12px] text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]">Change</button>
            </>
          )}
        </div>
      </div>

      {/* States */}
      {!dir && !needsPermission && (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="text-[12px] text-[var(--color-fg-muted)]">
            Set a folder once and ingest its PDFs into the inbox without picking files each time.
          </p>
          <button onClick={pickFolder} className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]">
            <FolderOpen className="h-4 w-4" /> Set working folder
          </button>
        </div>
      )}

      {needsPermission && !dir && (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="text-[12px] text-[var(--color-fg-muted)]">Reconnect <span className="font-medium text-[var(--color-ink)]">{dirName}</span> to keep using it (browsers re-ask after a restart).</p>
          <button onClick={reconnect} className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]">
            <FolderSync className="h-4 w-4" /> Reconnect folder
          </button>
        </div>
      )}

      {dir && (
        <div className="mt-3">
          {items.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-[var(--color-fg-muted)]">No PDFs in this folder.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-fg-dim)]">{items.length} PDF{items.length === 1 ? "" : "s"} · {pending} not yet ingested</span>
                <button
                  onClick={ingestAll}
                  disabled={busy || pending === 0}
                  className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-brand)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--color-brand-strong)] disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderSync className="h-3.5 w-3.5" />}
                  Ingest all
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto rounded-[10px] border border-[var(--color-border)]">
                {items.map((it) => (
                  <li key={it.name} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-fg-dim)]" />
                      <span className="truncate text-[12.5px] text-[var(--color-fg)]">{it.name}</span>
                    </span>
                    <span className="shrink-0">
                      {it.state === "done" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ok)]"><CheckCircle2 className="h-3.5 w-3.5" /> Ingested</span>
                      ) : it.state === "ingesting" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-dim)]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing</span>
                      ) : it.state === "error" ? (
                        <button onClick={() => ingest(it)} className="inline-flex items-center gap-1 text-[11px] text-[var(--color-alert)]" title={it.error}><XCircle className="h-3.5 w-3.5" /> Retry</button>
                      ) : (
                        <button onClick={() => { ingest(it).then(() => router.refresh()); }} className="rounded-[7px] border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]">Ingest</button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
