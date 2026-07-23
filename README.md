# LedgerOS

The operating system for modern CA practices — by Precedal.

A CA firm's morning is sorting: mail into folders, PDFs into clients, numbers
into Tally, deadlines into memory. LedgerOS does the sorting. A firm's
workflow is one line — **documents in → matched to a client → reconciled →
filed** — and the product is that line made real, with deterministic parsing
and the export formats the Indian compliance stack actually takes.

## What it does

**Inbox.** Drop in client documents — invoices, bank statements, GST returns,
Form 26AS, TDS challans, notices. Each is parsed, classified, matched to a
client, and lands in an inbox that works like email, except the sorting is
already done. An unmatched or ambiguous document becomes a review item, never
a silent guess.

**The client's month.** The workbench is one client × one period. Its screen
shows the month's ledger truth — documents in, matched, confirmed, input tax —
with reconciliation, registers, and exports sitting next to the numbers that
decide whether you need them. The nav is deliberately three destinations:
registers aren't places you go, they're things you do to a client's month.

**Reconciliation.** GSTR-2B against the purchase register (ITC at risk,
missing bookings), Form 26AS against the TDS register. Variances are flagged,
not hidden.

**Filing outputs.** GSTR-1 JSON shaped for the portal, Tally XML for the
ledger. The export bridge refuses low-confidence documents, so an ambiguous
invoice becomes a review item instead of a wrong return.

**Compliance calendar.** Per-client deadlines from a rules engine — due,
overdue, filed. No invented numbers anywhere in the app: every figure traces
to a document or a rule.

**Both sides of the invoice.** A separate business portal lets a firm's
client raise its own invoices, which land directly in the firm's books.

**Copilot.** Claude, grounded in the firm's parsed documents. It answers
questions about your data; it never produces the numbers.

## Why the numbers can be trusted

Parsing is deterministic by design — regex and an India knowledge base
(GSTIN/PAN, INR formats, dates, TDS sections), no LLM in the extraction path.
Field roles are read off the labels an invoice legally must carry, never
inferred from position: `pdf.js` emits text in draw order, so a two-column
header can put the buyer's block first, and guessing by position silently
swaps the parties.

When a label is missing or rivals disagree, the parser records low confidence
rather than guessing, and downstream exports refuse the document. Ambiguity
is surfaced, never averaged away. Re-parsing a stored document preserves the
client assignment, handling state, and every field a human corrected by hand.

## Stack

- **Next.js 16** (App Router, server actions) + **React 19**
- **Supabase** — Postgres (RLS, firm-scoped), Storage, Auth
- **Tailwind v4** (design tokens in `src/app/globals.css`)
- **unpdf** — serverless-safe PDF text extraction
- **Anthropic Claude** — the copilot only; document parsing is deterministic

## Repo layout

```
src/
  app/
    (app)/        CA workspace — inbox, clients, client/period, registers, exports
    business/     client-facing portal (a business raises its own invoices)
    api/          upload routes for GSTR-2B / Form 26AS
  lib/
    parser/       deterministic document parser (no LLM, no network)
      providers/    one per document kind, each scores its own confidence
      extractors/   India knowledge base — GSTIN/PAN, INR, dates, TDS sections
    export/       Tally XML, GSTR-1 JSON, and the document→line bridges
    db.ts         all Supabase reads
    *-actions.ts  server actions (mutations)
  components/
supabase/
  migrations/     schema, applied with scripts/db-exec.mjs
  seed/           demo firm + clients
scripts/          dev utilities and the test suites
```

## Quickstart

Prerequisites: Node 20+, a Supabase project.

```bash
npm install
cp .env.example .env.local        # fill in the Supabase values
node scripts/db-exec.mjs supabase/migrations/*.sql
node scripts/setup-storage.mjs    # creates the private `documents` bucket
npm run dev
```

`NEXT_PUBLIC_AUTH_ENABLED=false` (the default) leaves the route guard
pass-through and serves the seeded demo firm, so local dev needs no login.

## Tests

Plain assertion scripts — no framework. Each guards a specific past bug.

```bash
npx tsx scripts/test-parties.ts      # buyer/seller role assignment
npx tsx scripts/test-labelled.ts     # invoice number + date extraction
npx tsx scripts/test-reparse.ts      # re-parse merge (must not clobber manual edits)
npx tsx scripts/test-invoice.ts      # invoice → GSTR-1 lines
npx tsx scripts/test-voucher.ts      # canonical voucher + CSV
npx tsx scripts/test-gstr1.ts        # GSTR-1 JSON shape
npx tsx scripts/test-gstr1-bridge.ts # document → GSTR-1 bridge
npx tsx scripts/test-tally.ts        # Tally XML
```

## Status

Live: document ingestion + parsing, client matching, purchase register,
GSTR-2B and Form 26AS reconciliation, TDS register, Tally export, GSTR-1
generation, invoicing (both sides), compliance calendar, AI copilot.

Not yet built: email-forwarding ingestion — documents arrive by upload today.
The roadmap lives in [GOALS.md](GOALS.md).

The pre-rebuild FastAPI/Celery prototype (`legacy/`) was removed in `84e3317`;
it lives on in git history.
