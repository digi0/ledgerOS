/**
 * Compliance calendar, v1 — deterministic deadline generation from statutory
 * India due-dates. No table, no scraping: rules are code, inputs are the
 * firm's clients (GSTIN ⇒ GST filings apply) and the ingested GST returns
 * (a parsed GSTR for the same form+period marks its deadline Filed).
 *
 * v1 assumes monthly GST filers (QRMP quarterly scheme comes later, as a
 * per-client setting). Firm-wide statutory dates (TDS returns, advance tax,
 * ITR) are shown without client attribution until those data sources exist.
 */

import type { Client, DocumentRow } from "./types";

export interface Deadline {
  /** ISO due date yyyy-mm-dd. */
  date: string;
  form: string; // "GSTR-3B", "GSTR-1", "24Q/26Q", "Advance Tax", "ITR"
  label: string; // "GSTR-3B · May 2026"
  detail: string;
  scope: "client" | "firm";
  clientId?: string;
  clientName?: string;
  status: "filed" | "due" | "overdue";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Has a parsed GST return already been ingested for this client+form+period? */
function isFiled(
  gstReturns: DocumentRow[],
  client: Pick<Client, "id" | "gstin">,
  form: string,
  periodLabel: string,
): boolean {
  return gstReturns.some((d) => {
    const f = d.extracted_fields as Record<string, unknown>;
    if (f.form !== form || f.period !== periodLabel) return false;
    return d.client_id === client.id || (!!client.gstin && f.gstin === client.gstin);
  });
}

export function computeCompliance(opts: {
  clients: Pick<Client, "id" | "name" | "gstin">[];
  gstReturns: DocumentRow[];
  today?: Date;
  /** Days ahead to generate. Overdue unfiled items up to ~35 days back are kept. */
  horizonDays?: number;
}): Deadline[] {
  const { clients, gstReturns } = opts;
  const horizon = opts.horizonDays ?? 45;
  const now = opts.today ?? new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 35 * 86400_000);
  const end = new Date(now.getTime() + horizon * 86400_000);

  const out: Deadline[] = [];
  const inWindow = (d: string) => d >= start.toISOString().slice(0, 10) && d <= end.toISOString().slice(0, 10);

  // --- per-client GST filings (monthly): period M due in month M+1 ---------
  const gstClients = clients.filter((c) => c.gstin);
  for (let off = -2; off <= Math.ceil(horizon / 30) + 1; off++) {
    const p = new Date(now.getFullYear(), now.getMonth() + off, 1); // period month
    const periodLabel = `${MONTHS[p.getMonth()]} ${p.getFullYear()}`;
    const due = (day: number) => iso(
      p.getMonth() === 11 ? p.getFullYear() + 1 : p.getFullYear(),
      (p.getMonth() + 1) % 12,
      day,
    );
    for (const { form, day } of [
      { form: "GSTR-1", day: 11 },
      { form: "GSTR-3B", day: 20 },
    ]) {
      const date = due(day);
      if (!inWindow(date)) continue;
      for (const c of gstClients) {
        const filed = isFiled(gstReturns, c, form, periodLabel);
        if (date < todayIso && filed) continue; // past + done → drop the noise
        out.push({
          date,
          form,
          label: `${form} · ${periodLabel}`,
          detail: form === "GSTR-1" ? "Outward supplies" : "Monthly summary return",
          scope: "client",
          clientId: c.id,
          clientName: c.name,
          status: filed ? "filed" : date < todayIso ? "overdue" : "due",
        });
      }
    }
  }

  // --- firm-wide statutory dates (future-only; no filed-detection yet) -----
  const y = now.getFullYear();
  const firmDates: { date: string; form: string; label: string; detail: string }[] = [];
  for (const yr of [y - 1, y, y + 1]) {
    firmDates.push(
      { date: iso(yr, 6, 31), form: "TDS Return", label: "TDS Return · Q1", detail: "Forms 24Q/26Q · Apr–Jun quarter" },
      { date: iso(yr, 9, 31), form: "TDS Return", label: "TDS Return · Q2", detail: "Forms 24Q/26Q · Jul–Sep quarter" },
      { date: iso(yr, 0, 31), form: "TDS Return", label: "TDS Return · Q3", detail: "Forms 24Q/26Q · Oct–Dec quarter" },
      { date: iso(yr, 4, 31), form: "TDS Return", label: "TDS Return · Q4", detail: "Forms 24Q/26Q · Jan–Mar quarter" },
      { date: iso(yr, 5, 15), form: "Advance Tax", label: "Advance Tax · 1st instalment", detail: "15% of estimated liability" },
      { date: iso(yr, 8, 15), form: "Advance Tax", label: "Advance Tax · 2nd instalment", detail: "45% cumulative" },
      { date: iso(yr, 11, 15), form: "Advance Tax", label: "Advance Tax · 3rd instalment", detail: "75% cumulative" },
      { date: iso(yr, 2, 15), form: "Advance Tax", label: "Advance Tax · 4th instalment", detail: "100% of estimated liability" },
      { date: iso(yr, 6, 31), form: "ITR", label: `ITR · AY ${yr}-${String(yr + 1).slice(2)}`, detail: "Non-audit individuals & firms" },
      { date: iso(yr, 9, 31), form: "ITR", label: `ITR (audit) · AY ${yr}-${String(yr + 1).slice(2)}`, detail: "Audit cases · tax audit report by 30 Sep" },
      { date: iso(yr, 11, 31), form: "GSTR-9", label: `GSTR-9 · FY ${yr - 1}-${String(yr).slice(2)}`, detail: "Annual return · all regular GST registrants" },
    );
  }
  for (const f of firmDates) {
    if (f.date < todayIso || !inWindow(f.date)) continue;
    out.push({ ...f, scope: "firm", status: "due" });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.form.localeCompare(b.form));
}

/** Days from `today` to the deadline (negative = overdue). */
export function daysUntil(date: string, today?: Date): number {
  const t = (today ?? new Date()).toISOString().slice(0, 10);
  return Math.round((new Date(date).getTime() - new Date(t).getTime()) / 86400_000);
}
