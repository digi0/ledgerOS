# ledgerOS — Goals

> Tactical goal doc for this repo. Strategic, cross-project view is in
> `~/Documents/Projects/hub/goals.md`. If they disagree, the hub doc is intent
> — update this one to match. (Synced 2026-07-22: pivot confirmed there.)

**Window:** 2026-07-22 → 2026-08-31 (default — move it if the hub arbitration says otherwise)
**Priority:** P0 (slower fuse than vedAI)
**Phase:** post-MVP build — MVP shipped, pilot not started
**Last reviewed:** 2026-07-22

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

Priorities, in order — drawn from what the repo itself says is missing.
**Raghav: edit this list; it's a proposal, not a decision.**

1. **Email ingestion.** The pilot story is "forward your client emails,
   morning inbox is sorted" — but today documents only arrive by manual
   upload. Gmail forwarding-address ingestion is the missing spine of the
   original pitch.
2. **Privacy answer for CAs.** Data lives in Supabase and reaches Anthropic
   via the copilot. The old "your data stays local" pitch is dead; nothing
   replaced it. One page, decided, before any pilot conversation.
3. **Knowledge backbone.** GST rules / TDS rates / ICAI notifications feeding
   copilot grounding. Never started. Scope question below still open.
4. **Parser handoff seam.** The deterministic parser is built and tested
   in-repo (`src/lib/parser/`). If Anmol's lane is still open, the split into
   a swappable package is unstarted; decide whether it still matters.

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
