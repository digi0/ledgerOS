# LedgerOS — Pitch & Workflow Brief

> Your cheat-sheet to explain LedgerOS confidently. Read top-to-bottom once; the
> demo checklist and talking points are near the end. Everything marked **BUILT**
> is live at https://ledgeros-mu.vercel.app; **ROADMAP** is not built yet — don't
> promise it as done.

---

## 1. The one-liner

**LedgerOS is the operating system for a modern CA practice** — one place where a
Chartered Accountant sees every client's documents, compliance deadlines, and
filings, and acts on them, instead of juggling a shoebox of PDFs, Tally, WhatsApp,
and the GST portal.

CA-first.

## 2. The problem (say this to set up the pitch)

An Indian CA firm's monthly cycle is death by a thousand cuts:
1. **Chase clients** over WhatsApp/email for invoices, bank statements, bills.
2. **Re-key** everything into Tally by hand.
3. **Reconcile** GSTR-2B vs purchases (for ITC), 26AS vs TDS.
4. **Compute** the GST/TDS liability.
5. **File** GSTR-1, GSTR-3B, TDS returns — across dozens of clients, each with
   its own deadlines.

Steps 1 and 2 — **collection and data entry** — are where the hours die. And it's
all scattered across tools that don't talk to each other.

## 3. How it works — the two loops

LedgerOS runs two loops that both land in the same place: **structured, verified
data a CA can file from.**

```
  ┌─────────────────────── INBOUND: make sense of messy docs ───────────────────────┐
  │                                                                                  │
  │  Client documents          Deterministic parser        Auto-match                │
  │  (invoices, bank stmts,  ─► (rules, NO AI guessing) ─► (GSTIN→PAN→domain) ─► DOCUMENT
  │   GST returns, TDS,         classify + extract          to the right client)   INBOX
  │   notices) via email/                                                             │
  │   upload / working folder                                                         │
  └──────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
        ┌──────────────── the data becomes usable, per client ────────────────┐
        │  Purchase Register · TDS Register · GSTR-2B recon · 26AS recon ·      │
        │  Compliance Calendar (every deadline, per client, with status)        │
        └───────────────────────────────────────────────────────────────────────┘
                                          ▲
                                          │
  ┌─────────────────── OUTBOUND: create clean data at the source ────────────────────┐
  │                                                                                  │
  │  CA raises a GST invoice  ─►  born STRUCTURED  ─►  • printable tax-invoice PDF    │
  │  in LedgerOS (client does        (no parsing        • auto-fills outward register │
  │  their own — ROADMAP)             needed, ever)     • flows into GSTR-1           │
  └──────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                    GENERATE GSTR-1  ─►  portal JSON (no GSP licence)
                    (verify → download → upload to GST portal)

     Everything organised around the  CLIENT WORKSPACE  (pick a client → see
     what's due → act) and the  ⌘K COMMAND PALETTE + AI COPILOT (ask anything,
     answered only from the client's own documents).
```

**The key insight to land:** the inbound loop *copes* with mess (parse messy PDFs).
The outbound loop *prevents* mess at the source (generate the invoice structured,
so its GST filing is correct with zero re-keying). That's the wedge.

## 4. Step-by-step — a month in the life (the "model operation")

1. **Onboard the client** — add name, GSTIN/PAN, and which services (GST, TDS,
   ITR…). LedgerOS now knows their deadlines and can auto-match their documents.
2. **Documents flow in** — the CA (or client) forwards/uploads/points a working
   folder at the client's PDFs. LedgerOS parses, classifies, and matches each to
   the client automatically → they land in the **Document Inbox**.
3. **Raise the client's sales invoices** in LedgerOS — a proper GST tax invoice,
   GST auto-computed. Out comes a **printable invoice** *and* structured data that
   feeds the outward register and GSTR-1. **(BUILT.)**
4. **Reconcile** — GSTR-2B vs the purchase register (protect ITC), 26AS vs TDS.
   Mismatches are flagged, not hidden. **(BUILT.)**
5. **At period-end, open the client workspace** — the **"What's Due"** timeline
   shows every obligation with its urgency and a button to do it. Click **Generate
   GSTR-1** → review the totals → download the portal JSON → upload to the GST
   portal. **(BUILT — LedgerOS produces the file; the CA files.)**
6. **Track everything across clients** — the compliance calendar surfaces what's
   due and overdue, firm-wide. **(BUILT.)**
7. **Ask the copilot** — "what's pending for client X", "summarise this notice" —
   answered only from that firm's parsed documents, never invented. **(BUILT.)**

## 5. Demo checklist (run this order in the pitch)

- [ ] **Open the dashboard** — "here's the whole practice at a glance: documents
      in, pending compliance, what's overdue." (Numbers animate — feels alive.)
- [ ] **Open a client workspace** (`/clients/…`) — "instead of ten tabs, I pick a
      client and see *everything* — what's due, with the action right there."
- [ ] **Raise an invoice** — fill 2 lines, show GST auto-computing live, issue it,
      show the clean printable tax invoice.
- [ ] **Generate GSTR-1** — "that invoice already flowed in — one click, verified
      totals, download the portal JSON. Zero re-typing, so it's correct by
      construction."
- [ ] **⌘K** — type a client name → jump straight to them or their actions.
- [ ] **Copilot** — ask "what's pending for [client]" → grounded answer.
- [ ] (Optional) **Toggle dark mode** — polish signal.

## 6. Why it's different (talking points)

- **Trustworthy by design.** The parser and all the accounting math are
  **deterministic — no AI guessing.** For compliance, every number traces to a
  source document. AI is used only for *asking questions*, never for computing tax.
- **Attacks the root cause.** Most tools cope with messy PDFs forever. Our invoice
  generator makes the data *born correct*, so GST filing needs no re-keying.
- **No gatekeepers.** We generate the **importable file** (GSTN JSON now; Tally XML
  on the roadmap) — no GST-Suvidha-Provider or ERI licence needed, and it slots
  into the CA's existing workflow. The CA reviews before anything is filed.
- **Organised around the client, not the tool.** One workspace per client, built
  around their compliance timeline — not eleven scattered feature tabs.
- **The wedge for scale:** CA-first. A CA brings their *own* clients onto the
  business side — so we don't have to acquire SMEs one by one.

## 7. What's built vs roadmap (for honest Q&A)

**BUILT & live:** document ingestion + deterministic parser + auto-match, Document
Inbox, client workspace with the compliance timeline, invoice generator (→
printable invoice + register + GSTR-1), GSTR-2B & 26AS reconciliation, purchase &
TDS registers, compliance calendar, GSTN **GSTR-1 JSON** export, grounded AI
copilot, ⌘K command palette, working folder, dark mode. Stack: Next.js + Supabase
+ Anthropic Claude, on Vercel.

**ROADMAP (say "next", not "done"):**
- **Business-side login** — clients raise their *own* invoices, flowing to their CA
  (this turns it into a two-sided **ecosystem**).
- **Tally / Busy export** (needs a real Tally voucher file to build against).
- **GSTR-3B, TDS-return, ITR** file generation (GSTR-1 is the proof; same pattern).
- **Gmail auto-ingestion, OCR for scans.**
- **Data residency** — data is currently hosted outside India; an India-region /
  self-hosted option is the answer for privacy-sensitive clients.

## 8. The vision (close with this)

Today LedgerOS saves the CA the collection-and-filing grind. The bigger play is an
**ecosystem**: the business keeps its books in LedgerOS (starting with invoicing),
the CA reviews and files — one shared ledger between a business and its accountant.
The CA is the wedge that brings the businesses. That's how a "nice inbox" becomes
the operating system for the whole relationship.
