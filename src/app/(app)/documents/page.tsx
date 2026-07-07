import Link from "next/link";
import { inboxCounts, listClients, listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DocumentClassification, HandlingStatus } from "@/lib/types";
import DocumentRow from "@/components/DocumentRow";
import InboxFilters from "@/components/InboxFilters";
import UploadDocument from "@/components/UploadDocument";
import WorkingFolder from "@/components/WorkingFolder";

type SP = Promise<{ handling?: string; type?: string; client?: string; q?: string }>;

const TABS: { key: "" | HandlingStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "new", label: "New" },
  { key: "in_progress", label: "In Progress" },
  { key: "handled", label: "Handled" },
];

export default async function DocumentsPage({ searchParams }: { searchParams: SP }) {
  if (!isSupabaseConfigured()) return <NotConnected />;

  const sp = await searchParams;
  const handling = (sp.handling as HandlingStatus) || undefined;

  const [docs, counts, clients] = await Promise.all([
    listDocuments({
      handling,
      classification: (sp.type as DocumentClassification) || undefined,
      clientId: sp.client || undefined,
      search: sp.q || undefined,
    }),
    inboxCounts(),
    listClients(),
  ]);

  const total = counts.new + counts.in_progress + counts.handled;
  const countFor = (k: "" | HandlingStatus) => (k === "" ? total : counts[k]);

  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { type: sp.type, client: sp.client, q: sp.q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/documents?${s}` : "/documents";
  };

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Documents</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            AI-classified inbox · {counts.new} unprocessed
          </p>
        </div>
        <UploadDocument />
      </header>

      <WorkingFolder />

      <div className="card overflow-hidden">
        {/* tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-3">
          {TABS.map((t) => {
            const active = (handling ?? "") === t.key;
            return (
              <Link
                key={t.key || "all"}
                href={qs({ handling: t.key })}
                className={`-mb-px border-b-2 px-3 py-3 text-[13px] font-medium transition-colors ${
                  active
                    ? "border-[var(--color-brand)] text-[var(--color-ink)]"
                    : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {t.label}
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${
                    active
                      ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-fg-dim)]"
                  }`}
                >
                  {countFor(t.key)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="border-b border-[var(--color-border)] p-3">
          <InboxFilters clients={clients} />
        </div>

        {docs.length === 0 ? (
          <p className="px-4 py-16 text-center text-[var(--color-fg-muted)]">
            No documents match these filters.
          </p>
        ) : (
          docs.map((d) => <DocumentRow key={d.id} doc={d} />)
        )}
      </div>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="card p-6">
      <h2 className="font-display text-lg">Connect Supabase</h2>
      <p className="mt-1 text-[var(--color-fg-muted)]">
        Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and the keys in{" "}
        <code className="font-mono">.env.local</code>.
      </p>
    </div>
  );
}
