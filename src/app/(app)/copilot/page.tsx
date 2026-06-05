import { listClients } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import CopilotChat from "@/components/CopilotChat";

/** Rung 6 — Claude copilot grounded strictly on the firm's parsed documents. */
export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="card p-6">
        <h2 className="font-display text-lg">Connect Supabase</h2>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          The copilot needs the document inbox — set the Supabase keys in{" "}
          <code className="font-mono">.env.local</code> first.
        </p>
      </div>
    );
  }

  const clients = await listClients();
  const firstClient = clients[0]?.name;
  const suggestions = [
    ...(firstClient ? [`What's pending for ${firstClient}?`] : []),
    "Summarize the most recent notice",
    "Which documents are unmatched?",
    "What invoices came in this week?",
  ];

  return (
    <div className="fade-up space-y-5">
      <header>
        <h1 className="font-display text-2xl">AI Copilot</h1>
        <p className="mt-1 text-[var(--color-fg-muted)]">
          Grounded on your parsed documents — it answers from the inbox, or says it can&apos;t
        </p>
      </header>
      <CopilotChat suggestions={suggestions} />
    </div>
  );
}
