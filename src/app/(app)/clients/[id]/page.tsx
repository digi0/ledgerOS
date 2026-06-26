import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getClient, listDocuments } from "@/lib/db";
import { computeCompliance, daysUntil } from "@/lib/compliance";
import { CLIENT_SERVICES, type ClientService, CLASSIFICATION_LABELS } from "@/lib/types";
import { classificationBadge, fmtDate } from "@/lib/fields";
import ClientRowActions from "@/components/ClientRowActions";

export const dynamic = "force-dynamic";

const SERVICE_FORMS: Record<ClientService, string[]> = {
  gst:         ["GSTR-1", "GSTR-3B", "GSTR-9"],
  tds:         ["TDS Return"],
  itr:         ["ITR", "Advance Tax"],
  bookkeeping: [],
  audit:       ["ITR"],
  roc:         [],
  payroll:     [],
};

export default async function ClientProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  const [recentDocs, gstReturnDocs] = await Promise.all([
    listDocuments({ clientId: id, limit: 8 }),
    listDocuments({ classification: "gst_return", clientId: id, limit: 100 }),
  ]);

  const allDeadlines = computeCompliance({
    clients: client.gstin ? [{ id: client.id, name: client.name, gstin: client.gstin }] : [],
    gstReturns: gstReturnDocs,
    horizonDays: 90,
  });

  // Deadlines relevant to enrolled services
  const deadlinesForService = (svc: ClientService) => {
    const forms = SERVICE_FORMS[svc];
    if (!forms.length) return [];
    return allDeadlines.filter((d) => {
      const matchesForm = forms.some((f) => d.form.startsWith(f));
      const clientScoped = d.scope === "client" ? d.clientId === id : true;
      return matchesForm && clientScoped;
    });
  };

  const nextDeadline = (svc: ClientService) =>
    deadlinesForService(svc).find((d) => d.status !== "filed");

  const statusColor = (status: string) => {
    if (status === "filed") return "text-[var(--color-ok)]";
    if (status === "overdue") return "text-[var(--color-alert)]";
    return "text-[var(--color-fg-muted)]";
  };

  const urgencyBadge = (date: string, status: string) => {
    if (status === "filed") return null;
    const days = daysUntil(date);
    if (days < 0) return <span className="ml-1.5 rounded-full bg-[var(--color-alert)] px-2 py-0.5 text-[10px] font-semibold text-white">Overdue</span>;
    if (days <= 7) return <span className="ml-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">{days}d left</span>;
    return <span className="ml-1.5 text-[11px] text-[var(--color-fg-dim)]">{days}d</span>;
  };

  return (
    <div className="fade-up space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>

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
                <span
                  key={s}
                  className="rounded-full border border-[var(--color-brand)] bg-[var(--color-brand)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand-strong)]"
                >
                  {CLIENT_SERVICES[s as ClientService]}
                </span>
              ))}
            </div>
          )}
        </div>
        <ClientRowActions
          client={{
            id: client.id,
            name: client.name,
            gstin: client.gstin ?? undefined,
            pan: client.pan ?? undefined,
            primary_email: client.primary_email ?? undefined,
            services: client.services,
          }}
        />
      </header>

      {/* Service status cards */}
      {client.services.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Services
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {client.services.map((s) => {
              const svc = s as ClientService;
              const deadlines = deadlinesForService(svc);
              const next = nextDeadline(svc);
              const filed = deadlines.filter((d) => d.status === "filed").length;
              const overdue = deadlines.filter((d) => d.status === "overdue").length;

              return (
                <div key={svc} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-[13px] font-semibold text-[var(--color-ink)]">
                    {CLIENT_SERVICES[svc]}
                  </p>

                  {deadlines.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[var(--color-fg-dim)]">No deadlines in window</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {overdue > 0 && (
                        <p className="text-[12px] text-[var(--color-alert)]">{overdue} overdue</p>
                      )}
                      {filed > 0 && (
                        <p className="text-[12px] text-[var(--color-ok)]">{filed} filed</p>
                      )}
                      {next && (
                        <div className="mt-2 flex items-center text-[12px]">
                          <span className={statusColor(next.status)}>{next.label}</span>
                          {urgencyBadge(next.date, next.status)}
                        </div>
                      )}
                    </div>
                  )}

                  {svc === "bookkeeping" || svc === "roc" || svc === "payroll" ? (
                    <p className="mt-2 text-[11px] text-[var(--color-fg-dim)]">Module coming soon</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Recent documents */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              Recent Documents
            </h2>
            <Link
              href={`/documents?client=${id}`}
              className="text-[12px] text-[var(--color-brand)] hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            {recentDocs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-[var(--color-fg-muted)]">
                <FileText className="h-7 w-7 opacity-40" />
                <p className="text-[13px]">No documents yet</p>
                <Link href="/documents" className="text-[12px] text-[var(--color-brand)] hover:underline">
                  Upload documents
                </Link>
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {recentDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="block text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] truncate max-w-xs"
                        >
                          {doc.filename}
                        </Link>
                        <p className="text-[11px] text-[var(--color-fg-dim)]">{fmtDate(doc.created_at)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={classificationBadge(doc.classification)}>
                          {CLASSIFICATION_LABELS[doc.classification]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Compliance deadlines sidebar */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
            Upcoming Deadlines
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {allDeadlines.filter((d) => d.status !== "filed").slice(0, 8).length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-[var(--color-fg-muted)]">
                No upcoming deadlines
              </p>
            ) : (
              allDeadlines
                .filter((d) => d.status !== "filed")
                .slice(0, 8)
                .map((d, i) => {
                  const days = daysUntil(d.date);
                  return (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[var(--color-ink)] truncate">{d.label}</p>
                          <p className="text-[11px] text-[var(--color-fg-dim)]">{d.detail}</p>
                        </div>
                        <span className={`shrink-0 text-[12px] font-medium ${days < 0 ? "text-[var(--color-alert)]" : days <= 7 ? "text-amber-500" : "text-[var(--color-fg-muted)]"}`}>
                          {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
