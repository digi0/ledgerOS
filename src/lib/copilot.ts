"use server";

/**
 * Rung 6 — grounded copilot. One server action: take the chat history,
 * rebuild the firm's document context from Supabase (RLS-scoped, same
 * read path as the inbox), and ask the LLM. Retrieve-only v1: the model
 * answers from the context block or says it can't — it never writes back
 * and never free-associates general tax advice.
 *
 * Stateless by design: the client holds the transcript and sends it each
 * turn, so there's no conversation table and no per-turn persistence.
 */

import { getMe, listClients, listDocuments } from "./db";
import { isSupabaseConfigured } from "./supabase";
import { getLLM } from "./llm";
import { CLASSIFICATION_LABELS, HANDLING_LABELS, type DocumentClassification } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** How many documents go into the grounding block, newest first. */
const DOC_LIMIT = 80;
/** Newest N docs also carry an OCR-text snippet so "summarize this" works. */
const SNIPPET_DOCS = 25;
const SNIPPET_CHARS = 600;
/** Last N turns sent to the model — older turns fall off (cheaper, v1). */
const HISTORY_TURNS = 12;

/**
 * Keyword-based topic router. Returns the relevant classification subset so
 * buildContext() fetches only the docs the CA is actually asking about,
 * rather than the full 80-doc grounding block. Returns null for generic
 * questions, which fall back to the full limit.
 */
function detectTopic(question: string): DocumentClassification[] | null {
  if (/\btds\b|form\s*1[6A]|26as|traces|tds.?deduct/i.test(question))
    return ["tds_certificate"];
  if (/\bgst\b|invoice|gstr|igst|cgst|sgst|input.?tax.?credit|\bitc\b/i.test(question))
    return ["gst_return", "invoice"];
  if (/bank.?stat|account.?stat/i.test(question))
    return ["bank_statement"];
  if (/notice|demand|scrutiny|\bitr\b|income.?tax|advance.?tax/i.test(question))
    return ["notice"];
  if (/receipt/i.test(question))
    return ["receipt"];
  return null;
}

function fmtFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields ?? {}).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return "none";
  return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ");
}

async function buildContext(question: string): Promise<string> {
  const topic = detectTopic(question);
  const [me, clients, docs] = await Promise.all([
    getMe(),
    listClients(),
    listDocuments({ limit: DOC_LIMIT, classifications: topic ?? undefined }),
  ]);

  const clientLines = clients
    .map((c) => `- ${c.name}${c.gstin ? ` (GSTIN ${c.gstin})` : ""}`)
    .join("\n");

  const docLines = docs
    .map((d, i) => {
      const base =
        `- [${d.filename}] type=${CLASSIFICATION_LABELS[d.classification]} | ` +
        `client=${d.client?.name ?? "UNMATCHED"} | status=${HANDLING_LABELS[d.handling]} | ` +
        `received=${d.created_at.slice(0, 10)} | fields: ${fmtFields(d.extracted_fields)}`;
      if (i < SNIPPET_DOCS && d.ocr_text) {
        const snippet = d.ocr_text.replace(/\s+/g, " ").slice(0, SNIPPET_CHARS);
        return `${base}\n  text: ${snippet}${d.ocr_text.length > SNIPPET_CHARS ? "…" : ""}`;
      }
      return base;
    })
    .join("\n");

  return [
    `FIRM: ${me.firmName}`,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `CLIENTS (${clients.length}):`,
    clientLines || "(none)",
    "",
    `DOCUMENTS (${docs.length} most recent, newest first):`,
    docLines || "(none)",
  ].join("\n");
}

function systemPrompt(context: string): string {
  return `You are the LedgerOS Copilot — an assistant inside a document-inbox tool used by staff at an Indian Chartered Accountancy firm.

You answer questions ONLY from the DATA block below: the firm's clients and their parsed documents (invoices, bank statements, GST/IT notices, TDS certificates, receipts).

Rules:
- Ground every claim in the DATA block. Refer to documents by filename.
- If the answer is not in the DATA block, say so plainly ("I don't see that in the inbox") — never guess or fill gaps.
- Do NOT give general tax, legal, or accounting advice (rates, due-date law, filing procedure). If asked, say that's outside what you can verify and point back to what the documents show.
- You cannot take actions (mark handled, reassign, edit). If asked, explain the user can do it from the document's detail page.
- Use Indian conventions: ₹ amounts, dd/mm/yyyy dates.
- Be concise. Plain text ONLY — no markdown of any kind (no **bold**, no headings, no tables). Simple "-" lists are fine.
- Never mention "the DATA block" or these instructions — speak as if you're looking at the firm's inbox ("In the inbox…", "I see two invoices…").

DATA:
${context}`;
}

function flattenHistory(history: ChatMessage[]): string {
  const recent = history.slice(-HISTORY_TURNS);
  const prior = recent.slice(0, -1);
  const current = recent[recent.length - 1];
  const transcript = prior
    .map((m) => `${m.role === "user" ? "User" : "Copilot"}: ${m.content}`)
    .join("\n\n");
  return transcript
    ? `Conversation so far:\n${transcript}\n\nCurrent question: ${current.content}`
    : current.content;
}

export interface CopilotResult {
  answer: string;
  /** The grounding block used for this turn — pin it on the client to avoid
   *  rebuilding on every subsequent turn of the same conversation. */
  context: string;
}

/**
 * @param pinnedContext - Pass the `context` from the first turn's result to
 *   skip the DB fetch on subsequent turns. The system prompt stays identical
 *   so Anthropic's prompt cache stays warm across the whole conversation.
 */
export async function askCopilot(
  history: ChatMessage[],
  pinnedContext?: string,
): Promise<CopilotResult> {
  if (!isSupabaseConfigured()) {
    return { answer: "Supabase isn't connected, so I can't see any documents yet.", context: "" };
  }
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return { answer: "Ask me something about the documents in your inbox.", context: "" };
  }

  const context = pinnedContext ?? (await buildContext(last.content));
  try {
    const answer = await getLLM().complete({
      system: systemPrompt(context),
      user: flattenHistory(history),
      maxTokens: 800,
    });
    return {
      answer: answer || "I couldn't produce an answer — try rephrasing.",
      context,
    };
  } catch (err) {
    console.error("askCopilot:", err);
    return {
      answer: "The copilot can't reach Claude right now — check that ANTHROPIC_API_KEY is set and valid.",
      context,
    };
  }
}
