import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBusinessClient } from "@/lib/business-actions";
import { getInvoice } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import InvoiceSheet from "@/components/InvoiceSheet";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function BusinessInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to view invoices.</p></div>;
  }
  const business = await getBusinessClient();
  if (!business) redirect("/business/login");

  const { id } = await params;
  const inv = await getInvoice(id);
  // Scope: a business only sees its own invoices (demo mode bypasses RLS, so
  // the ownership check lives here — the same guard RLS will enforce later).
  if (!inv || inv.client_id !== business.id) notFound();

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3" data-noprint>
        <Link href="/business/invoices" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <PrintButton />
      </div>

      <InvoiceSheet inv={inv} />
    </div>
  );
}
