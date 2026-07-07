/**
 * CSV serializer — the universal fallback adapter. Turns canonical vouchers
 * into a flat, one-row-per-ledger-line sheet that imports into almost anything
 * (and doubles as the CA's own review sheet). This is the smoke test for the
 * canonical model: if a voucher can't be flattened cleanly, the model is wrong.
 *
 * Pure. Takes Voucher[], returns a CSV string. Never touches the DB or the
 * source document — same contract every export adapter honours.
 */

import type { Voucher } from "../voucher";

const COLUMNS = [
  "Date",
  "Voucher Type",
  "Reference",
  "Party",
  "Party GSTIN",
  "Ledger",
  "Debit",
  "Credit",
  "Narration",
  "Warnings",
] as const;

/** RFC-4180 field escaping — quote if it contains comma, quote, or newline. */
function esc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** dd/mm/yyyy for Indian software (Tally, Busy, Excel-IN all expect it). */
function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** A two-decimal amount, or blank for the zero side of a line. */
function amt(n: number): string {
  return n === 0 ? "" : n.toFixed(2);
}

export function vouchersToCsv(vouchers: Voucher[]): string {
  const rows: string[] = [COLUMNS.join(",")];

  for (const v of vouchers) {
    const warn = v.warnings.join("; ");
    for (const line of v.lines) {
      rows.push(
        [
          ddmmyyyy(v.date),
          v.kind,
          v.reference ?? "",
          v.party?.name ?? "",
          v.party?.gstin ?? "",
          line.ledger,
          amt(line.amount > 0 ? line.amount : 0), // debit
          amt(line.amount < 0 ? -line.amount : 0), // credit
          v.narration,
          warn,
        ]
          .map(esc)
          .join(","),
      );
    }
  }

  return rows.join("\r\n");
}
