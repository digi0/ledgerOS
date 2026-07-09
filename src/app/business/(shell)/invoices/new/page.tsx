import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBusinessClient } from "@/lib/business-actions";
import { isSupabaseConfigured } from "@/lib/supabase";
import InvoiceForm from "@/components/InvoiceForm";

export const dynamic = "force-dynamic";

/**
 * Raise an invoice, business-side. Same engine as the CA's Raise Invoice — the
 * business IS the supplier — but it lands back in the business area and, being
 * born structured, flows into the firm's outward register + GSTR-1 with no
 * re-keying.
 */
export default async function BusinessNewInvoicePage() {
  if (!isSupabaseConfigured()) {
    return <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Connect Supabase to raise invoices.</p></div>;
  }
  const business = await getBusinessClient();
  if (!business) redirect("/business/login");

  return (
    <div className="fade-up space-y-5">
      <div>
        <Link href="/business/invoices" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-fg-muted)] hover:text-[var(--color-ink)]">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <h1 className="font-display mt-2 text-2xl text-[var(--color-ink)]">Raise an invoice</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          A proper GST tax invoice, with tax computed for you. It goes to your accountant automatically.
        </p>
      </div>
      <InvoiceForm
        client={{ id: business.id, name: business.name, gstin: business.gstin }}
        redirectBase="/business/invoices"
      />
    </div>
  );
}
