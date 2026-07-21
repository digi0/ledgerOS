"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { removeExtractedField, setExtractedField } from "@/lib/actions";
import { inr } from "@/lib/fields";

/**
 * Extracted-fields panel with manual overrides: edit a value in place,
 * remove a wrong field, add a missing one. Server stores numeric-looking
 * input as numbers so formatting + copilot grounding stay consistent.
 */
export default function FieldEditor({
  id,
  fields,
}: {
  id: string;
  fields: Record<string, unknown>;
}) {
  // "_"-prefixed keys are parser/bookkeeping metadata (confidence flags, the
  // manual-override ledger) — not values a CA should see or edit.
  const entries = Object.entries(fields ?? {}).filter(([k]) => !k.startsWith("_"));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(key: string, value: string, close: () => void) {
    setError(null);
    start(async () => {
      const res = await setExtractedField(id, key, value);
      if (!res.ok) setError(res.error ?? "Save failed.");
      else close();
    });
  }

  function remove(key: string) {
    setError(null);
    start(async () => {
      const res = await removeExtractedField(id, key);
      if (!res.ok) setError(res.error ?? "Remove failed.");
    });
  }

  const iconBtn =
    "rounded p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)] disabled:opacity-50";

  return (
    <div>
      <dl className="mt-3 divide-y divide-[var(--color-border)]">
        {entries.length === 0 && !adding ? (
          <p className="py-2 text-sm text-[var(--color-fg-muted)]">
            No fields extracted — add one below.
          </p>
        ) : (
          entries.map(([k, v]) =>
            editingKey === k ? (
              <EditRow
                key={k}
                label={prettyKey(k)}
                initial={rawValue(v)}
                pending={pending}
                onSave={(val) => save(k, val, () => setEditingKey(null))}
                onCancel={() => setEditingKey(null)}
              />
            ) : (
              <div key={k} className="group flex items-start justify-between gap-3 py-2">
                <dt className="text-sm text-[var(--color-fg-muted)]">{prettyKey(k)}</dt>
                <dd className="flex items-center gap-1 text-right text-sm font-medium text-[var(--color-fg)]">
                  {formatValue(k, v)}
                  <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingKey(k)}
                      disabled={pending}
                      aria-label={`Edit ${k}`}
                      className={iconBtn}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(k)}
                      disabled={pending}
                      aria-label={`Remove ${k}`}
                      className={iconBtn}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </dd>
              </div>
            ),
          )
        )}
      </dl>

      {adding ? (
        <AddRow
          pending={pending}
          onSave={(key, val) => save(key, val, () => setAdding(false))}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]"
        >
          <Plus className="h-3.5 w-3.5" /> Add field
        </button>
      )}

      {error && <p className="mt-2 text-[11px] text-[var(--color-alert)]">{error}</p>}
    </div>
  );
}

function EditRow({
  label,
  initial,
  pending,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string;
  pending: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-sm text-[var(--color-fg-muted)]">{label}</dt>
      <dd className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(value);
            if (e.key === "Escape") onCancel();
          }}
          className="w-44 rounded-lg border border-[var(--color-brand)] bg-[var(--color-surface)] px-2 py-1 text-right text-sm outline-none"
        />
        <button onClick={() => onSave(value)} disabled={pending} aria-label="Save" className="rounded p-1 text-[var(--color-brand-strong)] hover:bg-[var(--color-surface-2)]">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button onClick={onCancel} disabled={pending} aria-label="Cancel" className="rounded p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)]">
          <X className="h-3.5 w-3.5" />
        </button>
      </dd>
    </div>
  );
}

function AddRow({
  pending,
  onSave,
  onCancel,
}: {
  pending: boolean;
  onSave: (key: string, value: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  return (
    <div className="mt-3 flex items-center gap-1.5">
      <input
        autoFocus
        value={key}
        onChange={(e) => setKey(e.target.value.replace(/\s+/g, "_").toLowerCase())}
        placeholder="field_name"
        className="w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 font-mono text-[12px] outline-none focus:border-[var(--color-brand)]"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSave(key, value)}
        placeholder="value"
        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--color-brand)]"
      />
      <button onClick={() => onSave(key, value)} disabled={pending || !key.trim()} aria-label="Add" className="rounded p-1 text-[var(--color-brand-strong)] hover:bg-[var(--color-surface-2)] disabled:opacity-50">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onCancel} disabled={pending} aria-label="Cancel" className="rounded p-1 text-[var(--color-fg-dim)] hover:bg-[var(--color-surface-2)]">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function prettyKey(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONEY_KEYS = /total|amount|value|balance|tds|cgst|sgst|igst|refund|paid/i;

function formatValue(key: string, v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && MONEY_KEYS.test(key)) return inr(v) ?? String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** The editable raw form of a value (no ₹ formatting in the input). */
function rawValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
