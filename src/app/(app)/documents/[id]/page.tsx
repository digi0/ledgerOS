import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getDocument, getSignedUrl, listClients } from "@/lib/db";
import { CLASSIFICATION_LABELS } from "@/lib/types";
import { classificationBadge, fmtDate } from "@/lib/fields";
import DetailActions from "@/components/DetailActions";
import DeleteDocument from "@/components/DeleteDocument";
import FieldEditor from "@/components/FieldEditor";
import CreateClientFromDoc from "@/components/CreateClientFromDoc";

export default async function DocumentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc, clients] = await Promise.all([getDocument(id), listClients()]);
  if (!doc) notFound();

  const signedUrl = await getSignedUrl(doc.storage_path);

  // Unmatched + the parser found an identity → offer one-click client creation.
  const f = doc.extracted_fields as Record<string, unknown>;
  const suggestedName = [f.trade_name, f.legal_name, f.vendor_name, f.account_holder].find(
    (v): v is string => typeof v === "string" && v.trim().length > 1,
  );
  const clientSuggestion =
    !doc.client_id && suggestedName
      ? {
          name: suggestedName,
          gstin: typeof f.gstin === "string" ? f.gstin : undefined,
          pan: typeof f.pan === "string" ? f.pan : undefined,
        }
      : null;

  return (
    <div className="fade-up space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to inbox
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className={classificationBadge(doc.classification)}>
            {CLASSIFICATION_LABELS[doc.classification]}
          </span>
          <h1 className="font-display mt-2 truncate text-xl" title={doc.filename}>
            {doc.filename}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {doc.client ? doc.client.name : "Unmatched"} ·{" "}
            {doc.classification_confidence != null
              ? `${Math.round(doc.classification_confidence * 100)}% confidence`
              : "—"}{" "}
            · added {fmtDate(doc.created_at)}
          </p>
        </div>
        <DeleteDocument id={doc.id} />
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* preview */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
          {signedUrl ? (
            <iframe
              src={signedUrl}
              title="Document preview"
              className="h-[640px] w-full rounded-lg"
            />
          ) : (
            <div className="grid h-[640px] place-items-center rounded-lg bg-[var(--color-surface-2)] text-center">
              <div className="px-6">
                <FileText className="mx-auto h-10 w-10 text-[var(--color-fg-dim)]" />
                <p className="mt-3 text-sm font-medium text-[var(--color-fg)]">
                  No file to preview yet
                </p>
                <p className="mt-1 max-w-xs text-xs text-[var(--color-fg-muted)]">
                  This is a seeded record. The PDF appears here once the ingestion pipeline stores
                  the file at{" "}
                  <code className="font-mono">{doc.storage_path}</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* fields + actions */}
        <div className="space-y-5">
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-display text-sm uppercase tracking-wide text-[var(--color-fg-dim)]">
              Actions
            </h2>
            <div className="mt-4 space-y-4">
              {clientSuggestion && (
                <CreateClientFromDoc docId={doc.id} suggestion={clientSuggestion} />
              )}
              <DetailActions
                id={doc.id}
                handling={doc.handling}
                classification={doc.classification}
                clientId={doc.client_id}
                clients={clients}
              />
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="font-display text-sm uppercase tracking-wide text-[var(--color-fg-dim)]">
              Extracted fields
            </h2>
            <FieldEditor id={doc.id} fields={doc.extracted_fields ?? {}} />
          </section>
        </div>
      </div>
    </div>
  );
}
