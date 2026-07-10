"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, CheckCheck, UserPlus, X, Keyboard } from "lucide-react";
import type { DocumentRow as Doc } from "@/lib/types";
import { CLASSIFICATION_LABELS, HANDLING_LABELS } from "@/lib/types";
import { classificationBadge, handlingBadge, keyFields, timeAgo } from "@/lib/fields";
import { bulkSetHandling, bulkReassignClient } from "@/lib/actions";
import { toast } from "@/components/Toast";

type Client = { id: string; name: string; gstin: string | null };

/**
 * Interactive inbox list — the daily-driver surface. Adds multi-select, bulk
 * mark-handled / assign-client, and keyboard nav so an articled assistant can
 * clear the inbox without reaching for the mouse:
 *   j / k  move ·  x / space  select ·  a  assign ·  e  mark handled
 *   ↵  open ·  esc  clear
 * Row click still opens the document (unchanged from the old list).
 */
export default function InboxList({ docs, clients }: { docs: Doc[]; clients: Client[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rowsRef = useRef<HTMLDivElement>(null);

  // Reset transient UI state whenever the underlying list changes (after a
  // server revalidation), so stale ids never linger in the selection.
  const ids = useMemo(() => docs.map((d) => d.id).join(","), [docs]);
  useEffect(() => {
    setSelected(new Set());
    setAssignOpen(false);
    setCursor((c) => Math.min(c, Math.max(0, docs.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  // The ids a bulk action applies to: the selection, or the cursor row as a
  // fallback so single-row keyboard actions work without selecting first.
  const targetIds = useCallback(() => {
    if (selected.size) return [...selected];
    const c = docs[cursor];
    return c ? [c.id] : [];
  }, [selected, docs, cursor]);

  const runHandled = useCallback(() => {
    const targets = targetIds();
    if (!targets.length) return;
    startTransition(async () => {
      const res = await bulkSetHandling(targets, "handled");
      if (res.ok) {
        toast.success(`${res.count} document${res.count === 1 ? "" : "s"} marked handled`);
        clear();
        router.refresh();
      } else toast.error(res.error);
    });
  }, [targetIds, clear, router]);

  const runAssign = useCallback(
    (clientId: string | null) => {
      const targets = targetIds();
      if (!targets.length) return;
      setAssignOpen(false);
      startTransition(async () => {
        const res = await bulkReassignClient(targets, clientId);
        if (res.ok) {
          const name = clientId ? clients.find((c) => c.id === clientId)?.name ?? "client" : "Unassigned";
          toast.success(
            clientId
              ? `${res.count} document${res.count === 1 ? "" : "s"} → ${name}`
              : `${res.count} document${res.count === 1 ? "" : "s"} unassigned`,
          );
          clear();
          router.refresh();
        } else toast.error(res.error);
      });
    },
    [targetIds, clear, clients, router],
  );

  // Keyboard nav. Ignore when typing in a field or when a modifier is held
  // (so ⌘K etc. pass through). Scoped to the window but guarded.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!docs.length) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, docs.length - 1));
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case "x":
        case " ":
          e.preventDefault();
          if (docs[cursor]) toggle(docs[cursor].id);
          break;
        case "e":
          e.preventDefault();
          runHandled();
          break;
        case "a":
          e.preventDefault();
          setAssignOpen((o) => !o);
          break;
        case "Enter":
          e.preventDefault();
          if (docs[cursor]) router.push(`/documents/${docs[cursor].id}`);
          break;
        case "Escape":
          if (selected.size) { e.preventDefault(); clear(); }
          if (assignOpen) setAssignOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docs, cursor, selected, assignOpen, toggle, runHandled, clear, router]);

  // Keep the cursor row in view.
  useEffect(() => {
    rowsRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const allSelected = docs.length > 0 && selected.size === docs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)));

  return (
    <div className="relative">
      {/* select-all + hint header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[var(--color-fg-muted)]">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3.5 w-3.5 accent-[var(--color-brand)]" />
          {selected.size ? `${selected.size} selected` : "Select all"}
        </label>
        <span className="hidden items-center gap-1.5 text-[11px] text-[var(--color-fg-dim)] sm:flex">
          <Keyboard className="h-3.5 w-3.5" />
          <kbd className="rounded border border-[var(--color-border)] px-1">j</kbd>
          <kbd className="rounded border border-[var(--color-border)] px-1">k</kbd> move ·{" "}
          <kbd className="rounded border border-[var(--color-border)] px-1">x</kbd> select ·{" "}
          <kbd className="rounded border border-[var(--color-border)] px-1">a</kbd> assign ·{" "}
          <kbd className="rounded border border-[var(--color-border)] px-1">e</kbd> handled
        </span>
      </div>

      <div ref={rowsRef}>
        {docs.map((doc, i) => {
          const fields = keyFields(doc);
          const isSel = selected.has(doc.id);
          const isCursor = i === cursor;
          return (
            <div
              key={doc.id}
              data-idx={i}
              onMouseEnter={() => setCursor(i)}
              className={`grid grid-cols-[auto_1.6fr_1fr_1.2fr_auto] items-center gap-4 border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0 ${
                isSel ? "bg-[var(--color-brand)]/[0.06]" : isCursor ? "bg-[var(--color-surface-2)]" : ""
              }`}
            >
              {/* select */}
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(doc.id)}
                aria-label={`Select ${doc.filename}`}
                className="h-3.5 w-3.5 accent-[var(--color-brand)]"
              />

              {/* type + filename (click opens) */}
              <button
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg-dim)]">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <span className={classificationBadge(doc.classification)}>{CLASSIFICATION_LABELS[doc.classification]}</span>
                  <p className="mt-1 truncate text-sm text-[var(--color-fg)]" title={doc.filename}>{doc.filename}</p>
                </div>
              </button>

              {/* client */}
              <div className="min-w-0 text-sm">
                {doc.client ? (
                  <span className="truncate text-[var(--color-fg)]">{doc.client.name}</span>
                ) : (
                  <span className="text-[var(--color-warn)]">Unmatched — assign</span>
                )}
              </div>

              {/* key fields */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {fields.length ? (
                  fields.map((f) => (
                    <span key={f.label} className="whitespace-nowrap">
                      <span className="text-[var(--color-fg-dim)]">{f.label} </span>
                      <span className="font-medium text-[var(--color-fg)]">{f.value}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[var(--color-fg-dim)]">—</span>
                )}
              </div>

              {/* status + time */}
              <div className="flex flex-col items-end gap-1">
                <span className={handlingBadge(doc.handling)}>{HANDLING_LABELS[doc.handling]}</span>
                <span className="text-xs text-[var(--color-fg-dim)]">{timeAgo(doc.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 mt-3 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 shadow-2xl">
            <span className="pl-2 pr-1 text-[12px] font-medium text-[var(--color-ink)]">{selected.size} selected</span>
            <button
              onClick={runHandled}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark handled
            </button>
            <div className="relative">
              <button
                onClick={() => setAssignOpen((o) => !o)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
              >
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </button>
              {assignOpen && (
                <div className="absolute bottom-full right-0 mb-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-2xl">
                  {clients.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[var(--color-fg-dim)]">No clients yet.</p>
                  ) : (
                    clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => runAssign(c.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
                      >
                        <span className="truncate">{c.name}</span>
                        <Check className="h-3.5 w-3.5 shrink-0 text-transparent" />
                      </button>
                    ))
                  )}
                  <div className="my-1 border-t border-[var(--color-border)]" />
                  <button
                    onClick={() => runAssign(null)}
                    className="w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]"
                  >
                    Unassign
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={clear}
              aria-label="Clear selection"
              className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
