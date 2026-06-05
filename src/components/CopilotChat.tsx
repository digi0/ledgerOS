"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";
import { askCopilot, type ChatMessage } from "@/lib/copilot";

/**
 * Copilot chat surface. The transcript lives in client state and is sent
 * whole on every turn (the server action is stateless); refresh = new chat.
 */
export default function CopilotChat({ suggestions }: { suggestions: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    startTransition(async () => {
      const answer = await askCopilot(next);
      setMessages([...next, { role: "assistant", content: answer }]);
    });
  }

  return (
    <div className="card flex h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden">
      {/* transcript */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-md">
              <span className="inline-grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand-soft)]">
                <Sparkles className="h-5 w-5 text-[var(--color-brand-strong)]" />
              </span>
              <h2 className="font-display mt-3 text-lg">Ask about your inbox</h2>
              <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
                Answers are grounded in your parsed documents — nothing else.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] text-[var(--color-fg-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-[var(--color-brand)] text-white"
                    : "rounded-bl-md bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {pending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[var(--color-surface-2)] px-4 py-2.5 text-[13.5px] text-[var(--color-fg-dim)]">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-[var(--color-border)] p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a client, a notice, what's pending…"
          className="h-10 flex-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13.5px] outline-none placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-border-strong)]"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Send"
          className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--color-brand)] text-white transition-colors hover:bg-[var(--color-brand-strong)] disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
