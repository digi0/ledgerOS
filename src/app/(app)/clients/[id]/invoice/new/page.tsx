import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getClient } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import InvoiceForm from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to raise invoices.</p></div>;
  }
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="fade-up space-y-5">
      <div>
        <Link href={`/clients/${id}`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-4 w-4" /> Back to {client.name}
        </Link>
        <h1 className="font-display mt-2 text-2xl">Raise Invoice</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          A GST tax invoice for {client.name} — issued here, it flows straight into their outward register and GSTR-1.
        </p>
      </div>
      <InvoiceForm client={{ id: client.id, name: client.name, gstin: client.gstin }} />
    </div>
  );
}
