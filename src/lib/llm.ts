/**
 * LLM access — Claude (Anthropic) everywhere, local dev included.
 *
 *   getLLM().complete({ system, user })  → string
 *
 * Requires ANTHROPIC_API_KEY in the environment (.env.local / Vercel).
 * Used by the copilot (rung 6). Deterministic parsing needs no LLM.
 */

import Anthropic from "@anthropic-ai/sdk";

export interface CompleteArgs {
  system: string;
  user: string;
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

class AnthropicProvider implements LLMProvider {
  async complete({ system, user, maxTokens }: CompleteArgs): Promise<string> {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
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
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — the copilot needs it.");
  }
  return new AnthropicProvider();
}
