/**
 * Tally XML export adapter — the headline serializer. Turns canonical
 * `Voucher[]` into the `<ENVELOPE>` import file Tally/TallyPrime ingests via
 * Gateway of Tally → Import → Vouchers (and, later, POSTed to the HTTP gateway
 * on :9000 unchanged). See docs/integration-pipeline.md.
 *
 * Pure. Takes Voucher[] (+ options), returns an XML string. Never touches the
 * DB or the source document — same contract every export adapter honours.
 *
 * Two things Tally gets counter-intuitively, pinned by golden tests
 * (scripts/test-tally.ts):
 *
 *   1. SIGN. Our canonical convention is +amount = debit, -amount = credit.
 *      Tally's <AMOUNT> is the OPPOSITE: a debit is NEGATIVE, a credit is
 *      POSITIVE, and each entry carries <ISDEEMEDPOSITIVE>Yes</> for a debit.
 *      So tally_amount = -canonical_amount. Get this backwards and every
 *      voucher posts inside-out.
 *
 *   2. LEDGERS MUST EXIST. A voucher only references ledger names; if a name
 *      isn't already a ledger in the company, import fails. So we emit the
 *      touched ledgers as <LEDGER> masters at the head of the same envelope
 *      (createMasters, on by default). Names are mapped canonical → Tally per
 *      client via `ledgerMap`; unmapped names pass through verbatim.
 */

import type { Voucher, VoucherKind } from "../voucher";

/** canonical ledger name → the ledger name as it exists in the client's Tally.
 *  Anything not present here is emitted under its canonical name unchanged. */
export type TallyLedgerMap = Record<string, string>;

export interface TallyOptions {
  /** Company as named in Tally. Emitted as SVCURRENTCOMPANY so the import
   *  targets the right company; omit to import into whatever's open. */
  company?: string;
  /** Per-client ledger-name mapping (our name ↔ their Tally ledger name). */
  ledgerMap?: TallyLedgerMap;
  /** Emit <LEDGER> master-create messages for every ledger the vouchers touch
   *  so import never fails on a missing ledger. Default true. Set false when
   *  the CA guarantees the masters already exist and wants a leaner file. */
  createMasters?: boolean;
}

/** Canonical voucher kind → Tally voucher type name (VCHTYPE / VOUCHERTYPENAME).
 *  These are Tally's default type names; a client who renamed them maps via a
 *  future voucher-type map (out of v1 scope — purchase is the only deriver). */
const VCH_TYPE: Record<VoucherKind, string> = {
  purchase: "Purchase",
  sales: "Sales",
  payment: "Payment",
  receipt: "Receipt",
  contra: "Contra",
  journal: "Journal",
};

/** Tally parent group for each canonical ledger, so an emitted master lands in
 *  the right place. Party ledgers are grouped by voucher kind (see partyGroup);
 *  anything unknown falls to Suspense A/c — visible and reviewable, never
 *  silently misclassified. */
const LEDGER_GROUP: Record<string, string> = {
  Purchases: "Purchase Accounts",
  Sales: "Sales Accounts",
  "Input CGST": "Duties & Taxes",
  "Input SGST": "Duties & Taxes",
  "Input IGST": "Duties & Taxes",
  "Output CGST": "Duties & Taxes",
  "Output SGST": "Duties & Taxes",
  "Output IGST": "Duties & Taxes",
  "Round Off": "Indirect Expenses",
};
const DEFAULT_GROUP = "Suspense A/c";

/** The party ledger's Tally group depends on which side of the trade it's on. */
function partyGroup(kind: VoucherKind): string {
  return kind === "sales" || kind === "receipt" ? "Sundry Debtors" : "Sundry Creditors";
}

/** One ledger the import will create (or reference). Its Tally name and parent
 *  group. Exposed so the export-review screen can tell the CA exactly what the
 *  import adds to their company before they run it — no silent master creation. */
export interface TallyMaster {
  name: string;
  group: string;
}

/**
 * The deduped set of ledger masters the vouchers touch, in emit order. Same
 * name-mapping and grouping the envelope uses — this IS the source the
 * serializer builds its <LEDGER> messages from, so the review can't drift from
 * the file.
 */
export function tallyMasters(vouchers: Voucher[], ledgerMap: TallyLedgerMap = {}): TallyMaster[] {
  const mapName = (canonical: string): string => ledgerMap[canonical] ?? canonical;
  const seen = new Map<string, string>(); // Tally ledger name → parent group
  for (const v of vouchers) {
    const party = v.party?.name ?? null;
    for (const line of v.lines) {
      const name = mapName(line.ledger);
      if (seen.has(name)) continue;
      const group =
        party && line.ledger === party ? partyGroup(v.kind) : LEDGER_GROUP[line.ledger] ?? DEFAULT_GROUP;
      seen.set(name, group);
    }
  }
  return [...seen].map(([name, group]) => ({ name, group }));
}

/** XML text/entity escaping — the five predefined entities. Applied to every
 *  ledger name, narration, reference and company name that reaches the output. */
function xesc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** "YYYY-MM-DD" → "YYYYMMDD" (Tally's date format; no separators). */
function tallyDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}${m[2]}${m[3]}` : iso.replace(/\D/g, "");
}

/** Two-decimal string with an explicit sign for negatives (Tally debits). */
function tallyAmount(n: number): string {
  return n.toFixed(2);
}

/**
 * Serialize canonical vouchers into a single Tally import envelope.
 *
 * Ordering matters: all ledger masters are emitted before any voucher, so
 * every ledger a voucher references already exists by the time Tally reads it.
 */
export function vouchersToTallyXml(vouchers: Voucher[], opts: TallyOptions = {}): string {
  const { company, ledgerMap = {}, createMasters = true } = opts;
  const mapName = (canonical: string): string => ledgerMap[canonical] ?? canonical;

  const messages: string[] = [];

  // ── Ledger masters (deduped across the whole batch) ──────────────────────
  if (createMasters) {
    for (const { name, group } of tallyMasters(vouchers, ledgerMap)) {
      messages.push(ledgerMaster(name, group));
    }
  }

  // ── Vouchers ─────────────────────────────────────────────────────────────
  for (const v of vouchers) {
    messages.push(voucherMessage(v, mapName));
  }

  const svc = company ? `\n        <SVCURRENTCOMPANY>${xesc(company)}</SVCURRENTCOMPANY>` : "";

  return [
    `<ENVELOPE>`,
    `  <HEADER>`,
    `    <TALLYREQUEST>Import Data</TALLYREQUEST>`,
    `  </HEADER>`,
    `  <BODY>`,
    `    <IMPORTDATA>`,
    `      <REQUESTDESC>`,
    `        <REPORTNAME>All Masters</REPORTNAME>`,
    `        <STATICVARIABLES>${svc}`,
    `        </STATICVARIABLES>`,
    `      </REQUESTDESC>`,
    `      <REQUESTDATA>`,
    ...messages.map((m) => m.replace(/^/gm, "        ")),
    `      </REQUESTDATA>`,
    `    </IMPORTDATA>`,
    `  </BODY>`,
    `</ENVELOPE>`,
  ].join("\n");
}

/** A single ledger-master create message. Minimal but valid: name + parent
 *  group. GST classification (TAXTYPE etc.) is refined later — a bare ledger
 *  under the right group imports cleanly and is the honest v1 surface. */
function ledgerMaster(name: string, group: string): string {
  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `  <LEDGER NAME="${xesc(name)}" ACTION="Create">`,
    `    <NAME>${xesc(name)}</NAME>`,
    `    <PARENT>${xesc(group)}</PARENT>`,
    `  </LEDGER>`,
    `</TALLYMESSAGE>`,
  ].join("\n");
}

function voucherMessage(v: Voucher, mapName: (n: string) => string): string {
  const vchType = VCH_TYPE[v.kind];
  const date = tallyDate(v.date);
  const partyName = v.party ? mapName(v.party.name) : null;

  const entries = v.lines.map((line) => {
    // Canonical: +debit / -credit. Tally: debit NEGATIVE, credit POSITIVE.
    const isDebit = line.amount > 0;
    const tally = -line.amount;
    return [
      `<ALLLEDGERENTRIES.LIST>`,
      `  <LEDGERNAME>${xesc(mapName(line.ledger))}</LEDGERNAME>`,
      `  <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
      `  <AMOUNT>${tallyAmount(tally)}</AMOUNT>`,
      `</ALLLEDGERENTRIES.LIST>`,
    ].join("\n");
  });

  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `  <VOUCHER VCHTYPE="${xesc(vchType)}" ACTION="Create" OBJVIEW="Accounting Voucher View">`,
    // REMOTEID is a deterministic per-document handle — the future dedup key so
    // a re-import updates rather than duplicates (docs/integration-pipeline.md).
    `    <REMOTEID>ledgeros-${xesc(v.source_document_id)}</REMOTEID>`,
    `    <DATE>${date}</DATE>`,
    `    <EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    `    <VOUCHERTYPENAME>${xesc(vchType)}</VOUCHERTYPENAME>`,
    v.reference ? `    <VOUCHERNUMBER>${xesc(v.reference)}</VOUCHERNUMBER>` : ``,
    partyName ? `    <PARTYLEDGERNAME>${xesc(partyName)}</PARTYLEDGERNAME>` : ``,
    v.narration ? `    <NARRATION>${xesc(v.narration)}</NARRATION>` : ``,
    ...entries.map((e) => e.replace(/^/gm, "    ")),
    `  </VOUCHER>`,
    `</TALLYMESSAGE>`,
  ]
    .filter((l) => l !== ``)
    .join("\n");
}
