"use client";

import { useState } from "react";
import { Download, AlertTriangle, MinusCircle, CheckCircle2 } from "lucide-react";
import { inr } from "@/lib/fields";
import type { Gstr1Summary } from "@/lib/export/gstr1";

interface SkipItem { docId: string; filename: string; reason: string }
interface FlagItem { docId: string; filename: string; messages: string[] }

/**
 * GSTR-1 export review. Server builds the return; this renders the summary the
 * CA verifies against the portal, lists what was skipped (inward/foreign) and
 * flagged (data-quality), and downloads the portal JSON. Nothing is filed here
 * — the CA reviews, downloads, and uploads to the GST portal themselves.
 */
export default function Gstr1Review({
  clientName,
  gstin,
  fp,
  summary,
  included,
  skipped,
  flagged,
  json,
}: {
  clientName: string;
  gstin: string;
  fp: string;
  summary: Gstr1Summary;
  included: number;
  skipped: SkipItem[];
  flagged: FlagItem[];
  json: string;
}) {
  const [downloaded, setDownloaded] = useState(false);

  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GSTR1_${gstin}_${fp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  const cards = [
    { label: "B2B Invoices", value: String(summary.b2b.invoices), sub: `${summary.b2b.recipients} recipients` },
    { label: "Taxable Value", value: inr(summary.totalTaxable) ?? "—", sub: null },
    { label: "CGST + SGST", value: inr(summary.hsn.cgst + summary.hsn.sgst) ?? "—", sub: "intra-state" },
    { label: "IGST", value: inr(summary.hsn.igst) ?? "—", sub: "inter-state" },
  ];

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[13px] text-[var(--color-fg-muted)]">
            {clientName} · GSTIN <span className="font-mono">{gstin}</span> · period{" "}
            <span className="font-semibold text-[var(--color-ink)]">{fp}</span>
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-fg-dim)]">
            {included} outward invoice{included === 1 ? "" : "s"} in this return
          </p>
        </div>
        <button
          onClick={download}
          disabled={included === 0}
          className="btn-glass inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-brand-strong)] disabled:opacity-40"
        >
          {downloaded ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {downloaded ? "Downloaded" : "Download GSTR-1 JSON"}
        </button>
      </div>

      {/* Summary cards — verify against the portal before filing */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">{c.label}</p>
            <p className="mt-1 font-display text-xl text-[var(--color-ink)]">{c.value}</p>
            {c.sub && <p className="mt-0.5 text-[11px] text-[var(--color-fg-dim)]">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Flagged — accepted but imperfect */}
      {flagged.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
              {flagged.length} invoice{flagged.length === 1 ? " needs" : "s need"} review
            </h3>
            <span className="text-[12px] text-[var(--color-fg-dim)]">— included, but verify before filing</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {flagged.map((f) => (
              <li key={f.docId} className="px-4 py-2.5">
                <a href={`/documents/${f.docId}`} className="text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand)] hover:underline">
                  {f.filename}
                </a>
                <ul className="mt-1 space-y-0.5">
                  {f.messages.map((m, i) => (
                    <li key={i} className="text-[12px] text-[var(--color-fg-muted)]">· {m}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skipped — not part of this return */}
      {skipped.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <MinusCircle className="h-4 w-4 text-[var(--color-fg-dim)]" />
            <h3 className="text-[13px] font-semibold text-[var(--color-ink)]">
              {skipped.length} document{skipped.length === 1 ? "" : "s"} not in this return
            </h3>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {skipped.map((s) => (
              <li key={s.docId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <a href={`/documents/${s.docId}`} className="text-[13px] text-[var(--color-fg)] hover:text-[var(--color-brand)] hover:underline">
                  {s.filename}
                </a>
                <span className="text-[12px] text-[var(--color-fg-dim)]">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[12px] text-[var(--color-fg-dim)]">
        Review these totals against the GST portal, then upload the JSON in the offline tool or
        the portal&apos;s Returns dashboard. LedgerOS does not file on your behalf.
      </p>
    </div>
  );
}
