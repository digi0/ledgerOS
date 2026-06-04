import Link from "next/link";
import { FileText } from "lucide-react";
import type { DocumentRow as Doc } from "@/lib/types";
import { CLASSIFICATION_LABELS, HANDLING_LABELS } from "@/lib/types";
import { classificationBadge, handlingBadge, keyFields, timeAgo } from "@/lib/fields";

export default function DocumentRow({ doc }: { doc: Doc }) {
  const fields = keyFields(doc);
  return (
    <Link
      href={`/documents/${doc.id}`}
      className="row-interactive grid grid-cols-[1.6fr_1fr_1.2fr_auto] items-center gap-4 border-b border-[var(--color-border)] px-4 py-3.5 last:border-b-0"
    >
      {/* type + filename */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-[var(--color-fg-dim)]">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <span className={classificationBadge(doc.classification)}>
            {CLASSIFICATION_LABELS[doc.classification]}
          </span>
          <p className="mt-1 truncate text-sm text-[var(--color-fg)]" title={doc.filename}>
            {doc.filename}
          </p>
        </div>
      </div>

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
    </Link>
  );
}
