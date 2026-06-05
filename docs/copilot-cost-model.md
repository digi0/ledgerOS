# Copilot cost model (rung 6 deliverable)

> GOALS.md: "before building, write a one-page cost model —
> (per-copilot-turn token cost × turns/day × CAs × 30) + infra".

## Per-turn anatomy

Model: `claude-haiku-4-5` ($1 / MTok input, $5 / MTok output; prompt-cache
write 1.25×, cache read 0.1×). Every turn rebuilds the grounding block
(80 docs metadata + OCR snippets for the newest 25) into the **system
prompt with `cache_control`**, so across a conversation it's written once
and read cheap.

| Component                  | Tokens   | Cost/turn        |
| -------------------------- | -------- | ---------------- |
| System + grounding (write) | ~10–15k  | $0.013–0.019 (turn 1) |
| System + grounding (read)  | ~10–15k  | $0.001–0.0015 (turn 2+) |
| History + question         | ~0.5–2k  | $0.0005–0.002    |
| Answer (≤800 max_tokens)   | ~300–500 | $0.0015–0.0025   |

**≈ $0.004–0.023 per turn → ₹0.3–2.0**, depending on cache state and
inbox size. Call it **₹1/question** as the planning number.

## Pilot-scale forecast

`turns/day × CAs × 30 × ₹1`:

| Scenario             | Turns/day/CA | CAs | Monthly LLM cost |
| -------------------- | ------------ | --- | ---------------- |
| Light                | 10           | 3   | ~₹900            |
| Expected             | 30           | 5   | ~₹4,500          |
| Heavy (upper bound)  | 60           | 5   | ~₹9,000 (~$105)  |

Infra on top: Vercel Hobby $0, Supabase free tier $0 at pilot scale.
**Total pilot burn ceiling ≈ $100–110/mo; expected ≈ $50/mo.**

## Levers if it runs hot

1. Trim `DOC_LIMIT` / `SNIPPET_DOCS` / `SNIPPET_CHARS` in `src/lib/copilot.ts`.
2. Drop `HISTORY_TURNS` (history is uncached input).
3. Per-firm daily turn cap (no code for this yet — add if a pilot CA abuses it).

## Watch-outs

- The grounding block grows with the inbox. At 80 docs it's ~10–15k tokens;
  the caps above are the control, not firm size.
- Cache TTL is 5 min — a slow back-and-forth re-writes the cache each turn.
  That's the $0.02 ceiling per turn, already priced in above.
