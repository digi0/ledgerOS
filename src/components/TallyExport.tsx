"use client";

import { useState } from "react";
import { Download, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";
import { inr } from "@/lib/fields";
import { toast } from "@/components/Toast";
import type { TallyMaster } from "@/lib/export/tally";

interface WarnItem { docId: string; reference: string | null; party: string | null; messages: string[] }

/**
 * Tally export review. Server derives the vouchers + XML; this renders what the
 * import will do — voucher count, total, the ledger masters it will CREATE in
 * the company (a trust point: no silent master creation), and any per-voucher
 * warnings the deriver raised — then downloads the .xml. LedgerOS does not post
 * to Tally; the CA imports the reviewed file themselves.
 */
export default function TallyExport({
  clientName,
  periodLabel,
  fileName,
  xml,
  voucherCount,
  totalValue,
  masters,
  warnings,
}: {
  clientName: string;
  periodLabel: string;
  fileName: string;
  xml: string;
  voucherCount: number;
  totalValue: number;
  masters: TallyMaster[];
  warnings: WarnItem[];
}) {
  const [downloaded, setDownloaded] = useState(false);

  function download() {
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    toast.success(`${fileName} downloaded · ${voucherCount} voucher${voucherCount === 1 ? "" : "s"}`);
  }

  const cards = [
    { label: "Vouchers", value: String(voucherCount), sub: "purchase entries" },
    { label: "Total Value", value: inr(totalValue) ?? "—", sub: null },
    { label: "Ledgers to create", value: String(masters.length), sub: "if not already in Tally" },
    { label: "Need review", value: String(warnings.length), sub: warnings.length ? "verify before import" : "all clean" },
  ];

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[13px] text-[var(--color-fg-muted)]">
            {clientName} · period <span className="font-semibold text-[var(--color-ink)]">{periodLabel}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-dim)]">
            {voucherCount} purchase voucher{voucherCount === 1 ? "" : "s"} ready to import into Tally
          </p>
        </div>
        <button
          onClick={download}
          disabled={voucherCount === 0}
          className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-brand-strong)] disabled:opacity-40"
        >
          {downloaded ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {downloaded ? "Downloaded" : "Download Tally XML"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">{c.label}</p>
            <p className="mt-1 font-display text-xl text-[var(--color-ink)]">{c.value}</p>
            {c.sub && <p className="mt-0.5 text-[11px] text-[var(--color-fg-dim)]">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Warnings — imported, but the deriver flagged something to eyeball */}
      {warnings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
              {warnings.length} voucher{warnings.length === 1 ? "" : "s"} to verify
            </h3>
            <span className="text-[12px] text-[var(--color-fg-dim)]">— included in the file, but check the parsed figures</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {warnings.map((w) => (
              <li key={w.docId} className="px-4 py-2.5">
                <a href={`/documents/${w.docId}`} className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline">
                  {w.reference ?? "(no invoice no.)"}{w.party ? ` · ${w.party}` : ""}
                </a>
                <ul className="mt-1 space-y-0.5">
                  {w.messages.map((m, i) => (
                    <li key={i} className="text-[12px] text-[var(--color-fg-muted)]">· {m}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ledger masters the import will create — the trust point */}
      {masters.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <BookOpen className="h-4 w-4 text-[var(--color-fg-dim)]" />
            <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
              {masters.length} ledger{masters.length === 1 ? "" : "s"} in this file
            </h3>
            <span className="text-[12px] text-[var(--color-fg-dim)]">— created on import if a ledger of the same name doesn&apos;t already exist</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {masters.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-[13px] text-[var(--color-fg)]">{m.name}</span>
                <span className="text-[12px] text-[var(--color-fg-dim)]">{m.group}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Import instructions */}
      <div className="card p-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">Importing into Tally</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] text-[var(--color-fg-muted)]">
          <li>Open the client&apos;s company in Tally / TallyPrime.</li>
          <li>Gateway of Tally → <span className="font-medium text-[var(--color-fg)]">Import</span> → <span className="font-medium text-[var(--color-fg)]">Vouchers</span> (older: Import Data → Vouchers).</li>
          <li>Select the downloaded <span className="font-mono text-[11px]">{fileName}</span> and confirm.</li>
          <li>Ledger names must match your company exactly — if a vendor or tax ledger already exists under a different name, map it before exporting so the entry lands on the right ledger.</li>
        </ol>
        <p className="mt-2 text-[12px] text-[var(--color-fg-dim)]">
          Review the vouchers in Tally before saving. LedgerOS does not post on your behalf.
        </p>
      </div>
    </div>
  );
}
