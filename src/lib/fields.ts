/**
 * Display helpers for the inbox: Indian currency/date formatting, the
 * per-type "key fields" shown on each row, and badge styling. Pure — safe
 * in server components.
 */

import type { DocumentClassification, DocumentRow, HandlingStatus } from "./types";

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(n: unknown): string | null {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  return inrFmt.format(v);
}

export function fmtDate(s: unknown): string | null {
  if (typeof s !== "string" || !s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** "2 hours ago" style relative time for the source column. */
export function timeAgo(s: string): string {
  const then = new Date(s).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(s) ?? s;
}

export interface KeyField {
  label: string;
  value: string;
}

/** The 1–2 key fields to surface per document type, from extracted_fields. */
export function keyFields(doc: DocumentRow): KeyField[] {
  const f = doc.extracted_fields ?? {};
  const out: KeyField[] = [];
  const push = (label: string, value: string | null) => {
    if (value) out.push({ label, value });
  };

  switch (doc.classification) {
    case "invoice":
      push("Total", inr(f.total));
      push("Invoice", asStr(f.invoice_number));
      break;
    case "bank_statement":
      push("Balance", inr(f.closing_balance));
      push("Period", asStr(f.period));
      break;
    case "notice":
      push("Due", fmtDate(f.due_date));
      push("Amount", inr(f.amount_disputed ?? f.refund_determined));
      break;
    case "tds_certificate":
      push("TDS", inr(f.tds_amount));
      push("Section", asStr(f.section));
      break;
    case "gst_return":
      push("Period", asStr(f.period));
      push("Tax", inr(f.total_tax));
      break;
    case "receipt":
      push("Total", inr(f.total));
      push("Date", fmtDate(f.date));
      break;
    default:
      push("Total", inr(f.total));
  }
  return out.slice(0, 2);
}

function asStr(v: unknown): string | null {
  return typeof v === "string" || typeof v === "number" ? String(v) : null;
}

// ---- Badge styling (token-based, light/dark aware) ----------------------

export function classificationBadge(c: DocumentClassification): string {
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ";
  switch (c) {
    case "invoice":
      return base + "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]";
    case "notice":
      return base + "bg-[var(--color-alert-soft)] text-[var(--color-alert)]";
    case "bank_statement":
      return base + "bg-[var(--color-ok-soft)] text-[var(--color-ok)]";
    case "tds_certificate":
      return base + "bg-[var(--color-warn-soft)] text-[var(--color-warn)]";
    case "gst_return":
      return base + "bg-[var(--color-ok-soft)] text-[var(--color-ok)]";
    default:
      return base + "bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]";
  }
}

export function handlingBadge(h: HandlingStatus): string {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ";
  switch (h) {
    case "new":
      return base + "bg-[var(--color-brand-soft)] text-[var(--color-brand-strong)]";
    case "in_progress":
      return base + "bg-[var(--color-warn-soft)] text-[var(--color-warn)]";
    case "handled":
      return base + "bg-[var(--color-ok-soft)] text-[var(--color-ok)]";
  }
}
