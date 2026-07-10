import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import InvoiceSheet from "@/components/InvoiceSheet";
import PrintButton from "@/components/PrintButton";
import Breadcrumbs from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to view invoices.</p></div>;
  }
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  return (
    <div className="fade-up space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3" data-noprint>
        <Breadcrumbs
          items={[
            { label: "Clients", href: "/clients" },
            { label: inv.supplier_name, href: `/clients/${inv.client_id}` },
            { label: inv.invoice_no },
          ]}
        />
        <PrintButton />
      </div>

      <InvoiceSheet inv={inv} />
    </div>
  );
}
