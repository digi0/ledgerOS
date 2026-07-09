import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, ReceiptText } from "lucide-react";
import { getBusinessClient } from "@/lib/business-actions";
import { listInvoices } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { inr } from "@/lib/fields";

export const dynamic = "force-dynamic";

function d(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default async function BusinessInvoicesPage() {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to use the business portal.</p></div>;
  }
  const business = await getBusinessClient();
  if (!business) redirect("/business/login");
  const invoices = await listInvoices(business.id);

  const total = invoices.reduce((s, i) => s + i.total, 0);

  return (
    <div className="fade-up space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-ink)]">Invoices</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
            Every invoice you raise here is already with your accountant.
          </p>
        </div>
        <Link href="/business/invoices/new" className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]">
          <FilePlus2 className="h-4 w-4" /> Raise an invoice
        </Link>
      </header>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ReceiptText className="h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <div>
              <p className="text-[14px] font-medium text-[var(--color-ink)]">No invoices yet</p>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">Raise your first GST invoice — it takes about a minute.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Invoice No.</th>
                  <th className="px-4 py-2.5">Buyer</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)]">
                    <td className="px-4 py-2.5 text-[12px] text-[var(--color-fg-muted)] tnum">{d(i.date)}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/business/invoices/${i.id}`} className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline">
                        {i.invoice_no}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-[13px] text-[var(--color-fg)]">{i.buyer_name}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        i.status === "cancelled"
                          ? "bg-[var(--color-alert-soft)] text-[var(--color-alert)]"
                          : "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                      }`}>
                        {i.status === "cancelled" ? "Cancelled" : "Issued"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tnum text-[var(--color-ink)]">{inr(i.total) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-2)]">
                  <td colSpan={4} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                    Total · {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[14px] font-bold tnum text-[var(--color-ink)]">{inr(total) ?? "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
