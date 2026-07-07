# Integration Pipeline — Tally & Other Software

> Ideation doc. How parsed documents in LedgerOS become entries inside the
> accounting/filing software a CA firm actually runs (Tally first). Status:
> design — no code yet. Owner: Raghav.

## The problem

Today the pipeline stops at "structured, validated, reconciled data inside
LedgerOS":

```
email/upload → parser → Document(+extracted_fields) → matcher → registers → recon
```

That data never leaves. A CA still re-keys the same invoices into **Tally**,
re-enters TDS, re-types GSTR-1 line items into the portal. LedgerOS has already
done the reading and the checking; the last mile — **push it into the system of
record** — is unbuilt. That last mile is the difference between "nice inbox" and
"saves me a day a week."

## The core idea: one canonical model, N serializers

Do **not** map every parser output straight to Tally XML. That couples the
parser to Tally and means re-doing the work for Busy, Zoho, the GST portal, etc.

Instead, introduce a **neutral canonical layer** — a source-system-agnostic
double-entry `Voucher` — and write one **serializer (adapter) per target**. This
is the same provider/adapter pattern the parser already uses and that Raghav
likes.

```
                          ┌─────────────── Tally XML (file / HTTP :9000)
Document / Register ──►  Voucher  ──►  ├─────────────── Busy XML
   (parsed facts)     (canonical    │   ├─────────────── GSTN offline JSON (GSTR-1)
                       double-entry) │   ├─────────────── Zoho Books / QuickBooks (REST)
                                     └─────────────── generic CSV / Excel
```

- **Deriving** `Voucher` from a Document is deterministic (no LLM) — same
  discipline as the registers.
- **Serializers** are pure functions `Voucher[] → string | payload`. Testable in
  isolation against golden files, exactly like the parser test suite.
- Adding a target = adding one adapter. The canonical model and everything
  upstream stay untouched.

## The canonical `Voucher` model (proposed)

A voucher is a balanced set of ledger lines — the lowest common denominator
across every accounting system, government-portal schema included.

```ts
type VoucherKind =
  | "purchase" | "sales" | "payment" | "receipt"
  | "contra"   | "journal";

interface Voucher {
  id: string;
  firm_id: string;
  client_id: string | null;
  kind: VoucherKind;
  date: string;                 // dd/mm/yyyy at the edge, ISO internally
  narration: string;
  reference: string | null;     // invoice no / cheque no / challan no
  source_document_id: string;   // provenance → back to the parsed doc
  party: PartyRef | null;       // ledger master this voucher touches
  lines: VoucherLine[];         // MUST sum to zero (Σ debit = Σ credit)
  gst: GstBreakup | null;       // taxable / cgst / sgst / igst / cess + HSN
  export_state: Record<string, ExportMark>;  // per-target: exported? when? id?
}

interface VoucherLine {
  ledger: string;               // canonical ledger name (mapped per target)
  amount: number;               // signed: +debit, -credit
  gst_rate?: number;
}
```

Two things earn their keep here:

1. **`source_document_id`** — every voucher traces to the doc it came from. No
   invented numbers (the standing rule), and re-parsing a fixed doc regenerates
   its voucher cleanly.
2. **`export_state`** — dedup. Re-running an export must never double-post into
   Tally. We stamp each voucher with `{tally: {exported_at, tally_masterid}}` so
   a second import is a no-op / update, not a duplicate.

## Target #1 — Tally (the one that matters in India)

Tally is the system of record for the overwhelming majority of Indian SMEs, so
it's target #1. Tally's integration surface, in order of pragmatism:

### (a) XML **file** import — v1, ship this first

Tally imports an `<ENVELOPE>` document containing `<TALLYMESSAGE>` voucher (and
ledger-master) elements. We write a `.xml` file; the CA does **Gateway of Tally →
Import → Vouchers** and picks the file.

- **Zero setup, offline, works with any Tally/TallyPrime version.**
- CA reviews before importing — they stay in control, which is exactly the trust
  posture a pilot needs.
- Matches the CA's real environment: Tally is on a desktop/on-prem, often not
  networked.

Shape (illustrative — real fields per voucher type):

```xml
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY><IMPORTDATA>
    <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
    <REQUESTDATA>
      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
          <DATE>20260704</DATE>
          <PARTYLEDGERNAME>Krishna Motors</PARTYLEDGERNAME>
          <NARRATION>Inv KM/2026/0142</NARRATION>
          <ALLLEDGERENTRIES.LIST> … party / purchase / Input CGST / Input SGST … </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
    </REQUESTDATA>
  </IMPORTDATA></BODY>
</ENVELOPE>
```

### (b) HTTP gateway — v2, "live sync"

TallyPrime can act as an HTTP server (Settings → Connectivity → act as server,
port **9000**). We POST the *same* XML to `http://localhost:9000` and get an
import response back. No file step. Requires Tally open, config on, same
machine/LAN. Same serializer, different delivery — so building (a) gets us (b)
nearly for free.

### The hard parts (must design for, not discover in the pilot)

- **Ledger masters must exist / be created.** A purchase voucher references a
  party ledger and tax ledgers. Either they already exist in Tally (names must
  match **exactly**) or we emit the `LEDGER` masters in the same envelope. The
  serializer needs a **ledger-name mapping** per client (our client name ↔ their
  Tally ledger name) — a small mapping table, editable by the CA.
- **GST ledgers & classification.** Input CGST/SGST/IGST ledgers, registered vs
  unregistered party, HSN/SAC, round-off. We already hold most of this in the
  register + `gst_rate`/`hsn_code` reference tables.
- **DR/CR sign convention.** Tally `<AMOUNT>` is signed (debit −, credit +, and
  it's the *opposite* of intuition in places). Golden-file tests pin this down.
- **Dedup.** `export_state` + Tally's masterid/GUID so re-import updates rather
  than duplicates.

### Where the data already is

The **Purchase Register** (`src/lib/gstr2b.ts` `RegisterEntry`) is already 90% of
a purchase voucher: gstin, invoiceNo, date, taxable, cgst/sgst/igst, total,
vendor, clientName. The first Tally serializer is largely a projection of
`RegisterEntry → Voucher → Tally XML`. Start there — it's the shortest path to a
real "export to Tally" a pilot CA can feel.

## Other software — tiered by value ÷ effort

| Target | Mechanism | Effort | Notes |
|---|---|---|---|
| **Tally** | XML file → HTTP :9000 | Med | #1. Above. |
| **Busy** | XML / Excel import | Med | #2 SME accounting; near-identical file-import model. Second adapter, reuses the canonical layer. |
| **Generic CSV / Excel** | file | **Low** | Universal fallback — imports into *anything*, and useful on its own (CA's own review sheet). Cheapest adapter; build alongside Tally as the smoke test for the canonical model. |
| **GSTN portal (GSTR-1)** | offline-tool **JSON** | Med | Filing, not bookkeeping. Generate the GST offline-utility JSON the CA uploads. **No GSP license** needed for that path. We already have the line items in the register. |
| **TRACES (TDS returns)** | RPU/FVU input | Med-High | Produce the input for the govt utility. TDS register already feeds this. |
| **Zoho Books / QuickBooks India** | REST (OAuth) | Med | Cloud, cleanest API — but smaller CA-firm footprint than Tally. Later. |
| **Income-Tax e-filing** | JSON for offline utility | High | API path needs an **ERI** license; JSON-for-utility is the no-license route. Later. |

**Principle: generate importable files, don't chase live API sync.** File/JSON
export needs **no partner licenses** (GSP/ERI), works **offline/on-prem** (the CA
reality), and keeps the **CA in control** (they review before it posts). Live
HTTP/API sync (Tally :9000, Zoho REST) is a strictly later tier layered on the
same canonical model.

## Proposed build order

1. **Canonical `Voucher` model** + migration (`voucher`, `voucher_line`,
   `export_state`) + `RegisterEntry → Voucher` deriver. Deterministic, tested.
2. **Generic CSV/Excel serializer** — trivial, proves the canonical model,
   immediately useful.
3. **Tally XML file serializer** (purchase vouchers first) + golden-file tests +
   a ledger-name mapping table per client. **This is the headline feature.**
4. **Export UI** — "Export to Tally" on the Purchase Register / a doc, review
   sheet, download `.xml`, mark `export_state`.
5. *Then* branch: Busy adapter, GSTN JSON, or Tally HTTP live-sync — whichever
   the pilot CA asks for first.

## Open questions for Raghav

- **First target to actually build** — Tally XML (headline, harder) vs generic
  CSV/Excel first (cheap, de-risks the canonical model)? Recommendation: build
  the canonical model + CSV together, then Tally.
- **Push direction** — export-only (LedgerOS → Tally) for v1, or eventually pull
  Tally masters back in (ODBC/HTTP) so client/ledger matching is automatic?
- **Which client's real Tally** can we test the XML import against? Golden files
  need one real round-trip to trust. (Own/family business first, per the privacy
  posture.)
