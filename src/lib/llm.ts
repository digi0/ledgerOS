/**
 * LLM provider switch — Claude in prod, Ollama in local dev.
 *
 *   getLLM().complete({ system, user })  → string
 *
 * Used by the copilot (rung 6) and as the extraction fallback for the
 * accounting-parser when a document doesn't match any deterministic
 * provider. Deterministic parsing itself needs no LLM.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface CompleteArgs {
  system: string;
  user: string;
  /** Hint the model to return JSON (Ollama uses native json mode). */
  json?: boolean;
  maxTokens?: number;
}

export interface LLMProvider {
  complete(args: CompleteArgs): Promise<string>;
}

function stripCodeFence(s: string): string {
  return s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ---------- Ollama (local dev) ----------

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3:8b";

class OllamaProvider implements LLMProvider {
  async complete({ system, user, json }: CompleteArgs): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: json ? "json" : undefined,
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return stripCodeFence(data.message?.content ?? "");
  }
}

// ---------- Anthropic (production) ----------

class AnthropicProvider implements LLMProvider {
  async complete({ system, user, maxTokens }: CompleteArgs): Promise<string> {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens ?? 1500,
      temperature: 0.2,
      // cache_control keeps the (stable) system prompt warm across turns.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    return stripCodeFence(
      msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join(""),
    );
  }
}

export function getLLM(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
  return new OllamaProvider();
}
