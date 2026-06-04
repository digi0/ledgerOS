"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { reassignClient, reclassify, setHandling } from "@/lib/actions";
import {
  CLASSIFICATION_LABELS,
  HANDLING_LABELS,
  type DocumentClassification,
  type HandlingStatus,
} from "@/lib/types";

const HANDLINGS = Object.keys(HANDLING_LABELS) as HandlingStatus[];
const CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as DocumentClassification[];

export default function DetailActions({
  id,
  handling,
  classification,
  clientId,
  clients,
}: {
  id: string;
  handling: HandlingStatus;
  classification: DocumentClassification;
  clientId: string | null;
  clients: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();

  const selectCls =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-brand)] disabled:opacity-50";

  return (
    <div className="space-y-5">
      {/* handling */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-fg-dim)]">
          Status
        </label>
        <div className="flex gap-1.5">
          {HANDLINGS.map((h) => {
            const active = h === handling;
            return (
              <button
                key={h}
                disabled={pending}
                onClick={() => start(() => setHandling(id, h))}
                className={`flex-1 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                {active && <Check className="mr-1 inline h-3.5 w-3.5" />}
                {HANDLING_LABELS[h]}
              </button>
            );
          })}
        </div>
      </div>

      {/* client */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-fg-dim)]">
          Client
        </label>
        <select
          disabled={pending}
          value={clientId ?? ""}
          onChange={(e) => start(() => reassignClient(id, e.target.value || null))}
          className={selectCls}
        >
          <option value="">Unmatched</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* type */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--color-fg-dim)]">
          Document type
        </label>
        <select
          disabled={pending}
          value={classification}
          onChange={(e) => start(() => reclassify(id, e.target.value as DocumentClassification))}
          className={selectCls}
        >
          {CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {CLASSIFICATION_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
