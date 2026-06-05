import Link from "next/link";
import { listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { inr } from "@/lib/fields";

export const dynamic = "force-dynamic";

/**
 * GST workspace, v1 — the filed returns the parser has ingested, by client
 * and period. Reconciliation (GSTR-2B vs purchase register) layers on top
 * of this once invoices flow in.
 */
export default async function GstPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to view GST data.</p>
      </div>
    );
  }

  const returns = await listDocuments({ classification: "gst_return", limit: 200 });

  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">GST</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          {returns.length} filed return{returns.length === 1 ? "" : "s"} on record · parsed
          from uploaded GSTR documents
        </p>
      </header>

      <div className="card overflow-hidden">
        {returns.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="max-w-md">
              <h2 className="font-display text-lg">No GST returns yet</h2>
              <p className="mt-2 text-[var(--color-fg-muted)]">
                Upload a GSTR-1 / GSTR-3B portal PDF on the documents page — it lands here
                automatically with period, liability, and ITC extracted.
              </p>
              <Link
                href="/documents"
                className="mt-5 inline-flex rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
              >
                Go to documents
              </Link>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                <th className="px-4 py-2.5">Taxpayer</th>
                <th className="px-4 py-2.5">Form</th>
                <th className="px-4 py-2.5">Period</th>
                <th className="px-4 py-2.5">Turnover</th>
                <th className="px-4 py-2.5">Total Tax</th>
                <th className="px-4 py-2.5">Net ITC</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((d) => {
                const f = d.extracted_fields as Record<string, unknown>;
                const name =
                  d.client?.name ??
                  (typeof f.trade_name === "string" ? f.trade_name : null) ??
                  (typeof f.legal_name === "string" ? f.legal_name : null) ??
                  "—";
                return (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${d.id}`}
                        className="text-[13px] font-medium text-[var(--color-ink)] hover:underline"
                      >
                        {name}
                      </Link>
                      <p className="font-mono text-[11px] text-[var(--color-fg-dim)]">
                        {typeof f.gstin === "string" ? f.gstin : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[13px]">{asStr(f.form)}</td>
                    <td className="px-4 py-3 text-[13px]">{asStr(f.period)}</td>
                    <td className="px-4 py-3 text-[13px] tnum">{inr(f.taxable_turnover) ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] tnum">{inr(f.total_tax) ?? "—"}</td>
                    <td className="px-4 py-3 text-[13px] tnum">{inr(f.net_itc) ?? "—"}</td>
                    <td className="px-4 py-3">
                      {f.status === "filed" ? (
                        <span className="rounded-full bg-[var(--color-ok-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ok)]">
                          Filed
                        </span>
                      ) : (
                        <span className="text-[12px] text-[var(--color-fg-dim)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[12px] text-[var(--color-fg-dim)]">
        Next for this module: GSTR-2B vs purchase-register reconciliation — needs purchase
        invoices uploaded so the register has entries to match.
      </p>
    </div>
  );
}

function asStr(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "—";
}
