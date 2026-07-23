# ledgerOS — Goals

> Tactical goal doc for this repo. Strategic, cross-project view is in
> `~/Documents/Projects/hub/goals.md`. If they disagree, the hub doc is intent
> — update this one to match. (Synced 2026-07-22: pivot confirmed there.)

**Window:** 2026-07-22 → 2026-08-31 (default — move it if the hub arbitration says otherwise)
**Priority:** P0 (slower fuse than vedAI)
**Phase:** post-MVP build — MVP shipped, pilot not started
**Last reviewed:** 2026-07-22

---

## What LedgerOS is

LedgerOS is the operating system a CA firm runs its practice on: every piece
of a client's financial life, arriving on any channel, sorted into one
workspace and prepped for filing — **LedgerOS does not file taxes; it makes
the CA filing-ready** — while keeping the firm's clients happy, connected,
and visible. Deterministic parsing (no LLM near a number), a workbench that
is one client × one month, GSTR-2B / 26AS recon, and the outputs the Indian
stack takes (GSTR-1 JSON, Tally XML). Documents are the legacy input the
product works to make unnecessary: data born structured at the source (portal
invoices today) needs no parser at all.

The [README](README.md) depicts the product as it exists. This file holds the
intent — where it's going and why. `CLAUDE.md` gives any agent session the
same grounding.

---

## Where the last window landed (2026-05-23 → 2026-07-31, closed early)

The MVP goal was met and overshot. Live in production (Vercel, deploys from
`main`): document ingestion + deterministic parsing, client matching, purchase
register, GSTR-2B and Form 26AS reconciliation, TDS register, Tally export,
GSTR-1 generation, invoicing (firm + business portal), compliance calendar,
grounded copilot, per-firm auth with RLS isolation.

Most of that list was "out of scope this window" in the previous version of
this doc. The build ladder (foundation → seed → parser → inbox → auth →
copilot) completed all six rungs. The copilot cost model got written:
`docs/copilot-cost-model.md`.

What did **not** happen: anything pilot-shaped. No CA has used it.

## This window: keep building

The roadmap (set by Raghav, 2026-07-22) — intake meets clients where they
already are, and the relationship lives next to the work:

1. **Email scraper.** Client mail ingested automatically into the inbox;
   today documents arrive by manual upload only.
2. **WhatsApp agent.** Converses with the firm's clients and intakes
   documents over WhatsApp — where Indian business paperwork actually moves.
3. **Client dashboard access.** The business portal grows from invoicing
   into a client's window on its own status and filings.
4. **CRM for the firm.** Who's pending what, who was told what — the client
   relationship managed inside LedgerOS.
5. **Privacy answer for CAs.** Data lives in Supabase and reaches Anthropic
   via the copilot — and the WhatsApp agent will raise the stakes. One page,
   decided, before any pilot conversation.

Carried, lower priority: knowledge backbone (GST rules / TDS rates feeding
copilot grounding — scope question below), parser handoff seam (swappable
package split, if Anmol's lane is still open).

Chore debt, not goals: 9 lint errors on `main` (7× the new
`set-state-in-effect` rule, one unescaped entity, one dep-array shape).

## Standing constraints (unchanged)

- **No hallucination on accounting facts.** Every claim traces to a source
  document or the knowledge layer. Quality bar that gates shipping.
- **Parser stays deterministic.** Regex + India knowledge base, no LLM in the
  extraction path. Ambiguity is surfaced (low confidence → review item),
  never averaged away.
- **Copilot cost is mapped, not capped.** Model in
  `docs/copilot-cost-model.md`; revisit when usage is real.

## Open questions

- **Privacy:** what exactly do we tell a CA who asks where client data goes?
  (Blocks pilot pitch. Priority 2 above is the work item.)
- **Pilot:** how many CAs, sourced where, what does success look like?
  Untouched from last window; becomes urgent the moment building pauses.
- **Knowledge backbone scope:** which sources (GST portal alone is
  non-trivial), refresh cadence, Postgres full-text vs. vector store — and is
  the pilot blocked without it, or can the copilot stay inbox-only?
- ~~**Hub sync**~~ — done 2026-07-22: pivot confirmed in the hub doc, window
  end set to 2026-08-31 (both marked as defaults Raghav can move).

## Pointers

- **Working copy:** `~/ledgerOS` (this repo). The clone at
  `~/Documents/Projects/ledgerOS` is stale (a week behind, local drift) —
  the reverse of what this doc used to say. Delete or refresh it.
- **Branches:** work lands on `main` via PRs; production deploys from `main`.
- **Notion task DB:** https://www.notion.so/024b27f981134e95a5130d007d0a4f2c
  (data source `4716cd19-79f4-4c1a-ab56-b29ba153aab7`). Notion holds tasks;
  this file holds intent. Tasks were seeded against the 2026-05 sequence and
  still need a rewrite to match reality.
