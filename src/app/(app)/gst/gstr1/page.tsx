import Link from "next/link";
import { FileJson } from "lucide-react";
import { getClient, listClients, listDocuments, listInvoicesWithLines } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { recentMonths } from "@/lib/fields";
import { buildClientGstr1 } from "@/lib/export/gstr1-bridge";
import { summarise } from "@/lib/export/gstr1";
import { invoicesToGstr1Lines } from "@/lib/invoice";
import PurchaseRegisterFilters from "@/components/PurchaseRegisterFilters";
import Gstr1Review from "@/components/Gstr1Review";

export const dynamic = "force-dynamic";

/**
 * GSTR-1 export. Pick a client + month → LedgerOS turns their parsed OUTWARD
 * invoices into the GST portal's GSTR-1 JSON (b2b / b2cs / hsn / docs), shows a
 * summary to verify and a skipped/flagged breakdown, and lets the CA download
 * the JSON to upload to the portal. See docs/integration-pipeline.md.
 */
export default async function Gstr1Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to generate GSTR-1.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const clientId = sp.client ?? "";
  const period = sp.period ?? "";
  const [clients] = await Promise.all([listClients()]);
  const periods = recentMonths();

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl">Generate GSTR-1</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Outward supplies → GST portal JSON · verify, download, upload
        </p>
      </div>
      <PurchaseRegisterFilters
        clients={clients}
        currentClient={clientId}
        currentPeriod={period}
        periods={periods}
        basePath="/gst/gstr1"
      />
    </header>
  );

  // Need both a specific client and a period to build a return.
  if (!clientId || !period) {
    return (
      <div className="fade-up space-y-5">
        {header}
        <div className="card grid place-items-center p-16 text-center">
          <div className="max-w-md">
            <FileJson className="mx-auto h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <h2 className="font-display mt-3 text-lg">Pick a client and month</h2>
            <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
              GSTR-1 is filed per taxpayer, per period. Choose one client and one month above to
              build their outward-supply return.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const client = await getClient(clientId);
  if (!client) {
    return (
      <div className="fade-up space-y-5">
        {header}
        <div className="card p-6"><p className="text-[var(--color-fg-muted)]">Client not found.</p></div>
      </div>
    );
  }

  if (!client.gstin) {
    return (
      <div className="fade-up space-y-5">
        {header}
        <div className="card p-6">
          <p className="text-[var(--color-fg-muted)]">
            {client.name} has no GSTIN on file — add one on the{" "}
            <Link href={`/clients/${client.id}`} className="text-[var(--color-brand)] hover:underline">client page</Link>{" "}
            before generating GSTR-1.
          </p>
        </div>
      </div>
    );
  }

  // Scope this client's parsed invoices to the chosen month (invoice date, else received).
  const allInvoices = await listDocuments({ classification: "invoice", clientId, limit: 1000 });
  const docs = allInvoices.filter((d) => {
    const date = typeof d.extracted_fields.date === "string" ? d.extracted_fields.date : d.created_at;
    return date.startsWith(period);
  });

  // Generated invoices for the month — structured at source, no parsing.
  const generatedInvoices = (await listInvoicesWithLines(clientId)).filter((iv) => iv.date.startsWith(period));
  const generatedLines = invoicesToGstr1Lines(generatedInvoices);

  const result = buildClientGstr1({ client: { gstin: client.gstin, name: client.name }, period, docs, generatedLines });
  const summary = summarise(result.return);
  const fp = result.return.fp;

  return (
    <div className="fade-up space-y-5">
      {header}
      {docs.length === 0 && generatedInvoices.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="max-w-md">
            <h2 className="font-display text-lg">No invoices for {client.name} in this month</h2>
            <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
              <Link href={`/clients/${clientId}/invoice/new`} className="text-[var(--color-brand)] hover:underline">Raise an invoice</Link>{" "}
              for this client, or upload their sales invoices on the{" "}
              <Link href="/documents" className="text-[var(--color-brand)] hover:underline">documents page</Link>{" "}
              — outward invoices for the period appear here.
            </p>
          </div>
        </div>
      ) : (
        <Gstr1Review
          clientName={client.name}
          gstin={client.gstin}
          fp={fp}
          summary={summary}
          included={result.included}
          skipped={result.skipped}
          flagged={result.flagged}
          json={JSON.stringify(result.return, null, 2)}
        />
      )}
    </div>
  );
}
