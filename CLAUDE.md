# LedgerOS — read this before reasoning about the product

## What LedgerOS is

LedgerOS is the operating system a Chartered Accountant firm runs its practice
on. A CA firm serves dozens of client businesses; its work product is filed
GST/TDS returns, built from a monthly flood of client paperwork arriving over
email, WhatsApp, and hand-delivery. LedgerOS captures all of it into one
sorted workspace, preps everything a filing needs, and keeps the firm's
clients connected to the firm.

**The boundary: LedgerOS does not file taxes.** It preps everything a CA
needs to file — reconciled registers, portal-ready GSTR-1 JSON, Tally XML —
and the CA files at the government portal. Prep, not filing, is the product.

**Do not mistake it for a document collector.** Documents are the legacy
input the product is working to make unnecessary. The aim is data born
structured at the source (a client raises its invoice inside LedgerOS → no
parsing, GSTR-1 is a direct projection of ledger rows) with the deterministic
parser as the migration path for everything that still arrives as paper.

## The two sides

- **Firm workspace** `src/app/(app)/` — auto-classified document inbox;
  the workbench is one client × one month (docs in / matched / confirmed /
  input tax, with recon, registers, and exports next to those numbers);
  GSTR-2B and Form 26AS reconciliation; purchase + TDS registers; GSTR-1
  JSON; Tally XML; rules-engine compliance calendar; grounded copilot.
- **Business portal** `src/app/business/` — the firm's client logs in and
  raises its own GST invoices. Costed deterministically, per-FY serials,
  written into the same firm ledger. "Nothing to email, nothing to re-key."

## Trust rules (non-negotiable)

- Parsing is deterministic — regex + an India knowledge base
  (`src/lib/parser/`). **No LLM ever touches a number.** Claude powers only
  the copilot, which answers questions over firm data.
- Ambiguity surfaces as a review item; low-confidence documents are refused
  by the export bridges rather than guessed at. Never averaged away.
- Every figure in the app traces to a source document or a rule.

## Where it's going (planned, NOT built — don't depict as live)

- **Email scraper** — client mail ingested automatically; today documents
  arrive by manual upload only.
- **WhatsApp agent** — converses with the firm's clients and intakes
  documents over WhatsApp, where Indian business paperwork actually moves.
- **Client dashboard access** — the business portal grows from invoicing
  into a client's window on its own status and filings.
- **CRM for the firm** — the client relationship (who's pending what,
  who was told what) managed inside LedgerOS.

The pitch in one line: **every piece of a client's financial life, arriving
on any channel, sorted and prepped so the CA only has to file — and the
client always feels looked after.**

## Working in this repo

- Stack: Next.js 16 App Router + React 19, Supabase (Postgres/RLS
  firm-scoped, Storage, Auth), Tailwind v4. Deploys on Vercel from `main`.
- `src/lib/db.ts` is all reads; `src/lib/*-actions.ts` are mutations.
- Tests are plain assertion scripts: `npx tsx scripts/test-*.ts` — run the
  parser suites after touching `src/lib/parser/` or `src/lib/export/`.
- `GOALS.md` holds intent and roadmap; `README.md` depicts the product.
- Local dev without secrets: `NEXT_PUBLIC_AUTH_ENABLED=false` serves the
  seeded demo firm, but DB reads need `SUPABASE_SERVICE_ROLE_KEY` in
  `.env.local` (deliberately not committed).
