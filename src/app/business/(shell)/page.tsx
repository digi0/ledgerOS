import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, ArrowRight, ReceiptText } from "lucide-react";
import { getBusinessClient } from "@/lib/business-actions";
import { listInvoices, getMe } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { inr } from "@/lib/fields";
import { financialYear } from "@/lib/gst";

export const dynamic = "force-dynamic";

function d(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export default async function BusinessDashboard() {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to use the business portal.</p></div>;
  }
  const business = await getBusinessClient();
  if (!business) redirect("/business/login");
  const [invoices, me] = await Promise.all([listInvoices(business.id), getMe()]);

  const thisFy = financialYear(new Date().toISOString().slice(0, 10));
  const fyInvoices = invoices.filter((i) => i.fy === thisFy);
  const billedThisFy = fyInvoices.reduce((s, i) => s + i.total, 0);
  const recent = invoices.slice(0, 5);

  const cards = [
    { label: "Invoices raised", value: String(invoices.length), sub: "all time" },
    { label: `Billed FY ${thisFy}`, value: inr(billedThisFy) ?? "₹0", sub: `${fyInvoices.length} invoice${fyInvoices.length === 1 ? "" : "s"}` },
  ];

  return (
    <div className="fade-up space-y-6">
      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-ink)]">Hello, {business.name}</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
            Raise a GST invoice and it lands with {me.firmName} automatically — nothing to email, nothing to re-key.
          </p>
        </div>
        <Link
          href="/business/invoices/new"
          className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[var(--color-brand-strong)]"
        >
          <FilePlus2 className="h-4 w-4" /> Raise an invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {cards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">{c.label}</p>
            <p className="mt-1 font-display text-xl text-[var(--color-ink)]">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-[var(--color-fg-dim)]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent invoices */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink)]">Recent invoices</h2>
          {invoices.length > 0 && (
            <Link href="/business/invoices" className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-brand)] hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <ReceiptText className="h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <div>
              <p className="text-[14px] font-medium text-[var(--color-ink)]">No invoices yet</p>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">Raise your first GST invoice — it takes about a minute.</p>
            </div>
            <Link href="/business/invoices/new" className="btn-glass mt-1 inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white">
              <FilePlus2 className="h-4 w-4" /> Raise an invoice
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recent.map((i) => (
              <li key={i.id}>
                <Link href={`/business/invoices/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)]">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-[var(--color-ink)]">{i.buyer_name}</span>
                    <span className="block text-[11px] text-[var(--color-fg-dim)]">{i.invoice_no} · {d(i.date)}</span>
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tnum text-[var(--color-ink)]">{inr(i.total) ?? "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
