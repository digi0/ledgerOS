import Link from "next/link";
import { listClients, listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to view clients.</p>
      </div>
    );
  }

  const [clients, docs] = await Promise.all([listClients(), listDocuments({ limit: 500 })]);
  const docCount = (id: string) => docs.filter((d) => d.client_id === id).length;

  return (
    <div className="fade-up space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl">Clients</h1>
          <p className="mt-1 text-[var(--color-fg-muted)]">
            {clients.length} active clients · unified view across books, compliance, and communication
          </p>
        </div>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
              <th className="px-4 py-2.5">Client</th>
              <th className="px-4 py-2.5">GSTIN</th>
              <th className="px-4 py-2.5">PAN</th>
              <th className="px-4 py-2.5">Documents</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
              >
                <td className="px-4 py-3 text-[13px] font-medium text-[var(--color-ink)]">{c.name}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
                  {c.gstin ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
                  {/* listClients returns id/name/gstin; PAN shown on detail later */}—
                </td>
                <td className="px-4 py-3 text-[13px] text-[var(--color-fg)]">{docCount(c.id)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/documents?client=${c.id}`}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                  >
                    View documents
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
