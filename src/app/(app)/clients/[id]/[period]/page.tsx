import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, FileCode, FileJson } from "lucide-react";
import { getClient, listDocuments } from "@/lib/db";
import Breadcrumbs from "@/components/Breadcrumbs";
import { classificationBadge, fmtDate, inr, monthLabel, num, str } from "@/lib/fields";
import { CLASSIFICATION_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * One client, one month — the whole chain on a single screen.
 *
 * This is the screen the nav used to make you assemble in your head out of
 * "Purchase Register", "GSTR-2B Recon" and "Export to Tally". Documents in →
 * matched → reconciled → filed, with the count that tells you whether the next
 * step is even needed, and the action to take it right there.
 */
export default async function ClientPeriod({
  params,
}: {
  params: Promise<{ id: string; period: string }>;
}) {
  const { id, period } = await params;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const client = await getClient(id);
  if (!client) notFound();

  const docs = (await listDocuments({ clientId: id, limit: 500 })).filter((d) =>
    docPeriod(d) === period,
  );

  const invoices = docs.filter((d) => d.classification === "invoice");
  const needsReview = docs.filter(unconfident);
  const unmatched = docs.filter((d) => !d.client_id);
  const taxable = invoices.reduce((s, d) => s + num(d.extracted_fields.taxable_value), 0);
  const tax = invoices.reduce(
    (s, d) =>
      s + num(d.extracted_fields.cgst) + num(d.extracted_fields.sgst) + num(d.extracted_fields.igst),
    0,
  );

  const steps = [
    { label: "Documents in", value: String(docs.length), done: docs.length > 0 },
    { label: "Matched to client", value: `${docs.length - unmatched.length}/${docs.length}`, done: unmatched.length === 0 && docs.length > 0 },
    { label: "Confirmed", value: `${docs.length - needsReview.length}/${docs.length}`, done: needsReview.length === 0 && docs.length > 0 },
    { label: "Input tax", value: inr(tax) ?? "—", done: tax > 0 },
  ];

  return (
    <div className="fade-up space-y-6">
      <Breadcrumbs
        items={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: `/clients/${id}` },
          { label: monthLabel(period) },
        ]}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-ink)]">{monthLabel(period)}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
            {client.name}
            {client.gstin && <span className="font-mono"> · {client.gstin}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/gst/gstr1?client=${id}&period=${period}`}
            className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
          >
            <FileJson className="h-4 w-4" /> Generate GSTR-1
          </Link>
          <Link
            href={`/export/tally?client=${id}&period=${period}`}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
          >
            <FileCode className="h-4 w-4" /> Export to Tally
          </Link>
        </div>
      </header>

      {/* The chain, left to right. Each number answers "is the next step needed?" */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              {s.label}
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-display text-xl tnum text-[var(--color-ink)]">
              {s.value}
              {s.done && <CheckCircle2 className="h-4 w-4 text-[var(--color-ok)]" />}
            </p>
          </div>
        ))}
      </div>

      {/* The parser says what it isn't sure about, instead of guessing. */}
      {needsReview.length > 0 && (
        <section className="card border-l-2 border-l-[var(--color-warn)] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warn)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--color-ink)]">
                {needsReview.length} document{needsReview.length === 1 ? "" : "s"} need you to confirm a field
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-fg-muted)]">
                The parser couldn&apos;t read these off a label, so it hasn&apos;t guessed. They&apos;re held
                back from the GSTR-1 until you confirm.
              </p>
              <ul className="mt-3 space-y-1.5">
                {needsReview.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/documents/${d.id}`}
                      className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-brand)] hover:underline"
                    >
                      {d.filename}
                      <span className="text-[var(--color-fg-dim)]">— {reviewReason(d)}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Documents this month
          </h2>
          <span className="text-[11px] text-[var(--color-fg-dim)]">
            Taxable {inr(taxable) ?? "—"}
          </span>
        </div>
        <div className="card overflow-hidden">
          {docs.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--color-fg-muted)]">
              Nothing filed under {monthLabel(period)} yet.{" "}
              <Link href="/documents" className="text-[var(--color-brand)] hover:underline">
                Upload documents
              </Link>
            </p>
          ) : (
            <table className="w-full">
              <tbody>
                {docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${d.id}`}
                        className="block max-w-xs truncate text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]"
                      >
                        {d.filename}
                      </Link>
                      <p className="text-[11px] text-[var(--color-fg-dim)]">
                        {str(d.extracted_fields.vendor_name) ?? "—"} · {fmtDate(d.created_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] tnum text-[var(--color-ink)]">
                      {inr(num(d.extracted_fields.total)) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={classificationBadge(d.classification)}>
                        {CLASSIFICATION_LABELS[d.classification]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

/** The month a document belongs to — its own invoice date, else when it landed. */
function docPeriod(d: { extracted_fields: Record<string, unknown>; created_at: string }): string {
  const date = str(d.extracted_fields.date);
  return (date ?? d.created_at).slice(0, 7);
}

/** Any field the parser declined to guess at. Mirrors the GSTR-1 bridge's
 *  refusals so this list is exactly what's being held back. */
function unconfident(d: { extracted_fields: Record<string, unknown> }): boolean {
  const f = d.extracted_fields;
  return (
    f._party_roles_confident === false ||
    f._invoice_number_confident === false ||
    f._date_confident === false
  );
}

function reviewReason(d: { extracted_fields: Record<string, unknown> }): string {
  const f = d.extracted_fields;
  if (f._party_roles_confident === false) return "who's the buyer?";
  if (f._invoice_number_confident === false) return "which invoice number?";
  return "which date?";
}

