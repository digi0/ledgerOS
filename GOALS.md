# ledgerOS — Goals

> Tactical goal doc for this repo. Strategic, cross-project view is in
> `~/Documents/Projects/hub/goals.md`. If they disagree, the hub doc is intent
> — update this one to match.

**Window:** 2026-05-23 → 2026-07-31 (~10 weeks)
**Priority:** P0 (but slower fuse than vedAI)
**Phase:** MVP build — past demo, before pilot
**Last reviewed:** 2026-06-03

---

## ⚡ PIVOT (2026-06-03) — supersedes conflicting sections below

Decision: build LedgerOS on the **medvault/vedAI stack**, not the Python scaffold.
This overrides the "Stack", "No auth this window", and parser-ownership lines below.
The hub doc still reflects the old local-first intent — **confirm the pivot there** too.

- **Stack:** **Next.js 16 (App Router) + TypeScript + Tailwind v4 + Supabase**
  (Postgres + Storage + Auth, via `@supabase/ssr`) + Anthropic Claude + a vendored
  **`accounting-parser`**. Deploy on Vercel. One stack across products. The Python
  FastAPI/Celery scaffold is preserved under `legacy/` as a schema reference only.
- **Auth:** **Supabase Auth** (per-firm), wired as rung 5 — not skipped. RLS is
  firm-scoped (`firm_id = current_firm_id()`), live from migration 0001.
- **Parser:** **we build it** — port medical-parser's deterministic provider
  architecture to `accounting-parser` (invoice / bank statement / TDS / GST notice,
  Claude fallback). Anmol's lane stays open: it's a swappable package.
- **Local-first → cloud.** Supabase is hosted, so the "your data stays local"
  pitch no longer holds. **Privacy answer for CAs is now an open question** (data
  resides in Supabase + reaches Anthropic via copilot). Decide before pilot.
- **Build ladder:** (1) ✅ Next.js+Supabase foundation → (2) Supabase live + accounting
  dataset seed → (3) accounting-parser → (4) Document Inbox → (5) Supabase Auth →
  (6) grounded copilot.
- **Working copy:** `~/Documents/Projects/ledgerOS`, branch `nextjs-supabase-rebuild`.
  (`~/ledgerOS` is a stale duplicate clone.)

---

## The 10-week goal

Ship a **minimum viable product** of ledgerOS that can be **piloted with Chartered Accountants in India**.

The FastAPI scaffold committed 2026-05-18 is demo-level infrastructure, not the MVP. The MVP is what we build next — real enough that an articled assistant at a working CA firm can use it for a week and tell us if it saves time.

> **Timeline note (2026-05-23):** originally targeted July 4 (6 weeks). Pushed to end of July to free hours for vedAI's MVP push, which Raghav prioritized as faster. ledgerOS now has the longest fuse of the three active builds (vedAI mid-June TBD → ACE Aug 5 → ledgerOS July 31).

## Definition of done (by July 31)

1. **Correct outputs.** Tools and features produce the right answer — reliably, not "usually."
2. **Testable.** Outputs verify against ground truth. Variances are flagged, not hidden.
3. **Outsmarts variances.** Unusual documents / transactions are handled gracefully — never crashed on, never hallucinated through.
4. **Runs locally, smoothly.** A pilot CA spins it up with `docker-compose up` + the supplied setup steps.
5. **No hallucination on accounting facts.** Every claim traces back to a source document or the Indian-accounting knowledge layer.

---

## Team & ownership

- **Raghav (this doc):** dashboard, copilot, knowledge backbone, end-to-end integration.
- **Anmol:** document parser / classifier — handles OCR + classification + field extraction. Integrates with Raghav's side when ready.

This GOALS.md scopes Raghav's track. Don't plan Anmol's surface here; only the handoff (which is "Anmol writes parsed docs into the shared Postgres schema, dashboard reads from there"). Coordinate with Anmol when his side is ready.

---

## Build sequence

### 1. Dashboard (first)

**User:** articled assistant / staff accountant at a CA firm. Not the partner.

**Home screen = Document Inbox.** Open dashboard → see a list of documents Anmol's parser has classified, newest first. Like an email client, but the sorting is done.

**Each row:**
- Document type (GST notice / TDS notice / invoice / bank statement / etc.)
- Client name (or "unmatched — click to assign")
- 1–2 key extracted fields (amount, due date, GSTIN/PAN — depends on type)
- Source (email account, sender, time)
- Status: New / In Progress / Handled

**Per-document detail:**
- PDF preview inline via `pdf.js`
- All extracted fields
- Manual overrides: wrong client / wrong type / fix field value
- One action: **Mark handled**

**Filters & search:**
- By client, document type, status, date range
- Free-text over filename + extracted text

**Stack:**
- Next.js frontend (matches your other products; React handles the rich inbox UI well)
- FastAPI backend (already scaffolded)
- Shared Postgres (the schema in `app/models/` is the contract with Anmol's parser)
- pdf.js for previews

**No auth this window.** Pilot CAs run locally on their machine; localhost is trusted. Skip Clerk/Supabase, skip login UI, skip user management. Add when pilot grows past single-user / when you deploy.

**Pilot story this enables:** *"Forward your client emails to ledgerOS. In the morning, open the dashboard. Everything is classified, matched to a client, ready to action. You spend your morning doing work, not sorting mail."*

### 2. Copilot (after dashboard works end-to-end)

In-product AI assistant. Calls **Claude API** (Anthropic).

**Why Claude not local:** Faster to build for the MVP window, smarter on multi-step reasoning, cost is manageable at pilot scale (a few hundred bucks/mo across ~5 CAs). Privacy tradeoff is real and called out below.

**What it does (v1, narrow):**
- Answers questions about documents in the dashboard ("what's pending for Client X?", "summarize this notice")
- Grounded in the parsed-document data (no free-association answers)

**Out of v1:** drafting outgoing replies, taking actions on the user's behalf.

**Cost mapping is a concrete deliverable:** before building, write a one-page cost model — `(per-copilot-turn token cost × turns/day × CAs × 30) + infra`. Use that to set a per-CA monthly burn forecast for pilot.

### 3. Knowledge backbone (parallel track, starts in window, may finish after)

Scrape + keep fresh: GST rules, TDS rates, ITR forms, ICAI announcements, Income Tax Dept notifications. Feed into copilot grounding so it can cross-check facts and avoid hallucination.

**Open questions before building (see below)** — which sources, refresh cadence, storage shape (Postgres vs. vector DB). Cheaper to scope this concretely after the dashboard is real and the copilot exists in v1 form.

---

## Constraints

- **Local-first.** `docker-compose` up, runs on a CA's machine. No public deploy this window.
- **Cost map, not a hard ceiling.** Claude Code handles dev-time AI cost (not billed per call). Runtime cost is only the copilot calling Claude API. Map it.
- **No hallucination on accounting facts.** Quality bar that gates shipping. If a feature can't be reliable, it doesn't go in the MVP.
- **Privacy:** every document parsed/queried via copilot reaches Anthropic's API. Pilot pitch cannot claim "your data stays local." Decide on a clear answer for CAs who ask.

---

## What exists today (2026-05-23)

The repo has a FastAPI scaffold (commit 2026-05-18) — treat it as **demo-level infrastructure, not MVP foundation:**

- FastAPI app skeleton, SQLAlchemy models (`firm`, `user`, `client`, `email_account`, `ingested_email`, `document`), Alembic migrations
- Celery worker with `NotImplementedError` task bodies
- `docker-compose.yml` for Postgres + Redis + MinIO
- Empty service stubs: `gmail.py`, `ocr.py`, `classifier.py`, `matcher.py`

Reusable as a starting point. **Not** "we're halfway done." Closer to 5–10% of MVP.

The README's "tool-by-tool" roadmap (Tools 1 → 7) is **stale** as of this doc. Rewrite it within the first week of this window so docs and direction match.

---

## Open questions

Each blocks a chunk of sequencing — answer one, the next stretch tightens.

### Dashboard
- **Single firm only this window?** (Assume yes unless told otherwise.)
- **What's the "Mark handled" workflow exactly** — just a status flip, or does it trigger something downstream (notification to partner, log entry, move to archive)?

### Copilot
- **Memory of past conversation turns** — yes (more useful, more tokens) or no (stateless, cheaper)?
- **Tool use** — does the copilot only retrieve and summarize, or can it write back to the database (e.g., "mark all of Client X's October GST notices as handled")? V1 = retrieve-only is the safer answer; flag explicitly.

### Knowledge backbone
- **Sources in scope this window?** GST portal alone is non-trivial. ICAI + Income Tax + RBI is a real scraping project.
- **Refresh cadence:** daily / weekly / on-demand?
- **Storage:** vector DB (Pinecone, Qdrant), plain Postgres + full-text, or both?
- **MVP requirement or stretch?** Is the pilot blocked without it, or can pilot run on copilot-without-knowledge as long as the answer set stays narrow ("only answer about documents in the inbox, never general accounting Qs")?

### Pilot
- **How many CAs, where from?** Personal network, cold outreach, ICAI chapter?
- **Contract:** free for X weeks in exchange for feedback?
- **Success looks like:** one CA saying "useful" / three saying "I'd pay" / measured hours saved per assistant per week?

---

## Notion task DB

- DB URL: https://www.notion.so/024b27f981134e95a5130d007d0a4f2c
- Data source ID: `4716cd19-79f4-4c1a-ab56-b29ba153aab7`

Notion holds individual tasks. This file holds intent. If a Notion task contradicts this file, raise it before completing the task.

> Notion tasks were seeded against the old README sequence (tool-by-tool). They need a rewrite to match the dashboard-first sequence. Do this in week 1.

---

## Out of scope this window

Explicit guardrail — none of the following ship before July 31:

- README Tools 2–6 (GST recon, TDS/26AS, ITR prep, Compliance calendar). They come *after* the pilot returns useful signal.
- Public deployment, real domain, SSL, production observability.
- Auth, login, multi-user — single-user local pilot.
- Drafting outgoing replies / acting on user behalf via copilot.
- Outlook / other email providers — Gmail only.
- Mobile — desktop only.
- Manual folder/tag organization — the classifier IS the organization.
- Time tracking, billing, client portal — different products.
- Multi-firm tenancy beyond what the schema supports.
