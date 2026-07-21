import Link from "next/link";
import { FileCode } from "lucide-react";
import { getClient, listClients, listDocuments } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { recentMonths } from "@/lib/fields";
import { documentsToVouchers } from "@/lib/voucher";
import { vouchersToTallyXml, tallyMasters } from "@/lib/export/tally";
import PurchaseRegisterFilters from "@/components/PurchaseRegisterFilters";
import TallyExport from "@/components/TallyExport";

export const dynamic = "force-dynamic";

/** Filename-safe slug from a client name. */
function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
}

/**
 * Tally export. Pick a client + month → LedgerOS derives canonical purchase
 * vouchers from their parsed invoices and serializes a Tally import file, shows
 * what the import will do (vouchers, ledgers it creates, warnings), and lets the
 * CA download the .xml to import via Gateway of Tally. The headline of the
 * integration pipeline — see docs/integration-pipeline.md.
 */
export default async function TallyExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <p className="text-[var(--color-fg-muted)]">Connect Supabase to export to Tally.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const clientId = sp.client ?? "";
  const period = sp.period ?? "";
  const clients = await listClients();
  const periods = recentMonths();

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl">Export to Tally</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Parsed purchase invoices → Tally voucher XML · review, download, import
        </p>
      </div>
      <PurchaseRegisterFilters
        clients={clients}
        currentClient={clientId}
        currentPeriod={period}
        periods={periods}
        basePath="/export/tally"
      />
    </header>
  );

  // A Tally file is per-company; require a specific client. Period optional
  // (blank = every parsed invoice for the client), mirroring the register.
  if (!clientId) {
    return (
      <div className="fade-up space-y-5">
        {header}
        <div className="card grid place-items-center p-16 text-center">
          <div className="max-w-md">
            <FileCode className="mx-auto h-8 w-8 text-[var(--color-fg-dim)] opacity-40" />
            <h2 className="font-display mt-3 text-lg">Pick a client</h2>
            <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
              A Tally import file targets one company. Choose a client above to build their
              purchase vouchers, then optionally narrow to a month.
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

  // This client's parsed purchase invoices, optionally scoped to the month.
  const allDocs = await listDocuments({ classification: "invoice", clientId, limit: 1000 });
  const docs = period
    ? allDocs.filter((d) => {
        const date = typeof d.extracted_fields.date === "string" ? d.extracted_fields.date : d.created_at;
        return date.startsWith(period);
      })
    : allDocs;

  const vouchers = documentsToVouchers(docs);
  const xml = vouchersToTallyXml(vouchers, { company: client.name });
  const masters = tallyMasters(vouchers);

  // Total value = sum of debits (taxable + tax) across vouchers = invoice value.
  const totalValue = vouchers.reduce(
    (s, v) => s + v.lines.reduce((t, l) => t + (l.amount > 0 ? l.amount : 0), 0),
    0,
  );

  const warnings = vouchers
    .filter((v) => v.warnings.length > 0)
    .map((v) => ({
      docId: v.source_document_id,
      reference: v.reference,
      party: v.party?.name ?? null,
      messages: v.warnings,
    }));

  const periodLabel = period ? periods.find((p) => p.value === period)?.label ?? period : "all invoices";
  const fileName = `Tally_${slug(client.name)}_${period || "all"}.xml`;

  return (
    <div className="fade-up space-y-5">
      {header}
      {vouchers.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="max-w-md">
            <h2 className="font-display text-lg">No purchase invoices for {client.name}{period ? " this month" : ""}</h2>
            <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
              Upload {client.name}&apos;s purchase invoices on the{" "}
              <Link href="/documents" className="text-[var(--color-brand)] hover:underline">documents page</Link>{" "}
              — parsed invoices become Tally vouchers here automatically.
            </p>
          </div>
        </div>
      ) : (
        <TallyExport
          clientName={client.name}
          periodLabel={periodLabel}
          fileName={fileName}
          xml={xml}
          voucherCount={vouchers.length}
          totalValue={totalValue}
          masters={masters}
          warnings={warnings}
        />
      )}
    </div>
  );
}
