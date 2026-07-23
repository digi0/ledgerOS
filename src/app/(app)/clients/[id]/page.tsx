import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FilePlus2, FileJson, CheckCircle2, Store } from "lucide-react";
import { getClient, listDocuments, listInvoices } from "@/lib/db";
import { enterAsBusiness } from "@/lib/business-actions";
import Breadcrumbs from "@/components/Breadcrumbs";
import { computeCompliance, daysUntil, type Deadline } from "@/lib/compliance";
import { CLIENT_SERVICES, type ClientService, CLASSIFICATION_LABELS } from "@/lib/types";
import { classificationBadge, fmtDate, inr, recentMonths, str } from "@/lib/fields";
import ClientRowActions from "@/components/ClientRowActions";

export const dynamic = "force-dynamic";

/**
 * Client workspace — the operating surface for one client. Instead of hopping
 * GST / TDS / register / recon tabs, the CA lands here and sees the whole
 * picture: what's due (with the action to do it), what's been raised, what's
 * come in. The scattered tools become drill-downs from this timeline.
 */
export default async function ClientWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [allDocs, gstReturnDocs, invoices] = await Promise.all([
    listDocuments({ clientId: id, limit: 500 }),
    listDocuments({ classification: "gst_return", clientId: id, limit: 100 }),
    listInvoices(id),
  ]);
  const recentDocs = allDocs.slice(0, 8);

  // Documents per month, for the period strip.
  const docsByPeriod = new Map<string, number>();
  for (const d of allDocs) {
    const key = (str(d.extracted_fields.date) ?? d.created_at).slice(0, 7);
    docsByPeriod.set(key, (docsByPeriod.get(key) ?? 0) + 1);
  }

  const deadlines = computeCompliance({
    clients: client.gstin ? [{ id: client.id, name: client.name, gstin: client.gstin }] : [],
    gstReturns: gstReturnDocs,
    horizonDays: 90,
  }).filter((d) => (d.scope === "client" ? d.clientId === id : true));

  const open = deadlines.filter((d) => d.status !== "filed");
  const filedCount = deadlines.filter((d) => d.status === "filed").length;

  // The action that completes a given obligation, when we have one wired.
  const actionFor = (d: Deadline): { href: string; label: string } | null => {
    if (d.form === "GSTR-1" && d.period) return { href: `/gst/gstr1?client=${id}&period=${d.period}`, label: "Generate" };
    return null;
  };

  const urgency = (date: string) => {
    const days = daysUntil(date);
    if (days < 0) return <span className="rounded-full bg-[var(--color-alert)] px-2 py-0.5 text-[10px] font-semibold text-white">{Math.abs(days)}d overdue</span>;
    if (days <= 7) return <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">{days}d left</span>;
    return <span className="text-[11px] text-[var(--color-fg-dim)]">{days}d</span>;
  };

  return (
    <div className="fade-up space-y-6">
      <Breadcrumbs items={[{ label: "Clients", href: "/clients" }, { label: client.name }]} />

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-[var(--color-ink)]">{client.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--color-fg-muted)]">
            {client.gstin && <span className="font-mono">{client.gstin}</span>}
            {client.pan && !client.gstin && <span className="font-mono">{client.pan}</span>}
            {client.primary_email && <span>{client.primary_email}</span>}
            <span>Client since {fmtDate(client.created_at)}</span>
          </div>
          {client.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {client.services.map((s) => (
                <span key={s} className="glass-pill rounded-full border border-[var(--color-brand)]/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand-strong)]">
                  {CLIENT_SERVICES[s as ClientService]}
                </span>
              ))}
            </div>
          )}
        </div>
        <ClientRowActions
          client={{
            id: client.id, name: client.name,
            gstin: client.gstin ?? undefined, pan: client.pan ?? undefined,
            primary_email: client.primary_email ?? undefined, services: client.services,
          }}
        />
      </header>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/clients/${id}/invoice/new`} className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]">
          <FilePlus2 className="h-4 w-4" /> Raise Invoice
        </Link>
        <Link href={`/gst/gstr1?client=${id}`} className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]">
          <FileJson className="h-4 w-4" /> Generate GSTR-1
        </Link>
        {/* Enter this client's own business-side portal (the two-sided view). */}
        <form action={enterAsBusiness.bind(null, id)}>
          <button type="submit" className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border)] px-4 py-2 text-[13px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]">
            <Store className="h-4 w-4" /> Open business portal
          </button>
        </form>
      </div>

      {/* Months — the unit of work. Registers, recons and exports live inside
          one of these, not in the nav. */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
          Months
        </h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {recentMonths(12).map((m) => {
            const count = docsByPeriod.get(m.value) ?? 0;
            return (
              <Link
                key={m.value}
                href={`/clients/${id}/${m.value}`}
                className="card shrink-0 px-4 py-3 text-left hover:bg-[var(--color-surface-2)]"
              >
                <p className="whitespace-nowrap text-[13px] font-medium text-[var(--color-ink)]">
                  {m.label}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--color-fg-dim)]">
                  {count === 0 ? "—" : `${count} document${count === 1 ? "" : "s"}`}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Compliance timeline — the spine: what's due, with the action to do it */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">What&apos;s Due</h2>
          {filedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ok)]">
              <CheckCircle2 className="h-3.5 w-3.5" /> {filedCount} filed in window
            </span>
          )}
        </div>
        <div className="card divide-y divide-[var(--color-border)]">
          {open.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--color-fg-muted)]">
              {client.gstin ? "Nothing due in the next 90 days." : "Add a GSTIN to track this client's GST deadlines."}
            </p>
          ) : (
            open.map((d, i) => {
              const action = actionFor(d);
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-ink)]">{d.label}</p>
                    <p className="text-[11px] text-[var(--color-fg-dim)]">{d.detail} · due {fmtDate(d.date)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {urgency(d.date)}
                    {action ? (
                      <Link href={action.href} className="rounded-[8px] bg-[var(--color-brand)] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[var(--color-brand-strong)]">
                        {action.label}
                      </Link>
                    ) : (
                      <span className="w-[68px] text-right text-[11px] text-[var(--color-fg-dim)]">tracked</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Data — what's been raised + what's come in */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">Invoices Raised</h2>
            <Link href={`/clients/${id}/invoice/new`} className="text-[12px] text-[var(--color-brand)] hover:underline">Raise invoice</Link>
          </div>
          <div className="card overflow-hidden">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--color-fg-muted)]">
                <FilePlus2 className="h-7 w-7 opacity-40" />
                <p className="text-[13px]">No invoices raised yet</p>
                <Link href={`/clients/${id}/invoice/new`} className="text-[12px] text-[var(--color-brand)] hover:underline">Raise the first one</Link>
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {invoices.map((iv) => (
                    <tr key={iv.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                      <td className="px-4 py-3">
                        <Link href={`/invoices/${iv.id}`} className="block text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]">{iv.invoice_no}</Link>
                        <p className="text-[11px] text-[var(--color-fg-dim)]">{iv.buyer_name} · {fmtDate(iv.date)}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">{inr(iv.total) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">Recent Documents</h2>
            <Link href={`/documents?client=${id}`} className="text-[12px] text-[var(--color-brand)] hover:underline">View all</Link>
          </div>
          <div className="card overflow-hidden">
            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--color-fg-muted)]">
                <FileText className="h-7 w-7 opacity-40" />
                <p className="text-[13px]">No documents yet</p>
                <Link href="/documents" className="text-[12px] text-[var(--color-brand)] hover:underline">Upload documents</Link>
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                      <td className="px-4 py-3">
                        <Link href={`/documents/${doc.id}`} className="block max-w-xs truncate text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)]">{doc.filename}</Link>
                        <p className="text-[11px] text-[var(--color-fg-dim)]">{fmtDate(doc.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={classificationBadge(doc.classification)}>{CLASSIFICATION_LABELS[doc.classification]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
