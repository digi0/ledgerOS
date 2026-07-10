"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, TriangleAlert, Info, X } from "lucide-react";

/**
 * Lightweight toast system. A module-level store lets any client code fire a
 * toast without threading a context/provider through props:
 *
 *   import { toast } from "@/components/Toast";
 *   toast.success("Invoice issued");
 *   toast.error("Couldn't save — try again");
 *
 * Mount <Toaster /> once (root layout) and it renders the stack. Auto-dismiss
 * after a few seconds; dismissable by hand.
 */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let seq = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  for (const l of listeners) l(items);
}

function push(kind: ToastKind, message: string, ms = 4000) {
  const id = ++seq;
  items = [...items, { id, kind, message }];
  emit();
  if (ms > 0) setTimeout(() => dismiss(id), ms);
  return id;
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message, 6000),
  info: (message: string) => push("info", message),
  dismiss,
};

const ICON = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
} as const;

const ACCENT = {
  success: "text-[var(--color-ok)]",
  error: "text-[var(--color-alert)]",
  info: "text-[var(--color-brand)]",
} as const;

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    setList(items);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {list.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="animate-toast-in card pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3"
          >
            <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${ACCENT[t.kind]}`} />
            <p className="min-w-0 flex-1 text-[13px] text-[var(--color-ink)]">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
