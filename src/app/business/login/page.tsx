import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { listClients } from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/supabase";
import { enterAsBusiness } from "@/lib/business-actions";

export const dynamic = "force-dynamic";

/**
 * Business login (prototype). A real product authenticates a business owner to
 * their own company; here we pick which of the firm's clients to act as. Each
 * client on the CA side is a business the firm serves — selecting one enters
 * the business-side interface for it.
 */
export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const clients = isSupabaseConfigured() ? await listClients() : [];

  return (
    <div className="grid min-h-screen place-items-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand)] font-display text-lg text-white">L</span>
          <h1 className="font-display text-2xl text-[var(--color-ink)]">Business Portal</h1>
          <p className="mt-1 text-[13px] text-[var(--color-fg-muted)]">
            Raise your own GST invoices — they flow straight to your accountant.
          </p>
        </div>

        {sp.error === "notfound" && (
          <p className="mb-4 rounded-[10px] border border-red-500/30 bg-red-500/5 px-3 py-2 text-[12px] text-red-500">
            That business could not be found. Pick one below.
          </p>
        )}

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-fg-dim)]">Choose your business</p>
          </div>

          {clients.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Building2 className="mx-auto h-7 w-7 text-[var(--color-fg-dim)] opacity-40" />
              <p className="mt-2 text-[13px] text-[var(--color-fg-muted)]">No businesses yet.</p>
              <p className="mt-1 text-[12px] text-[var(--color-fg-dim)]">
                Your accountant adds you as a client first — then you appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {clients.map((c) => (
                <li key={c.id}>
                  <form action={enterAsBusiness.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-2)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-[var(--color-ink)]">{c.name}</span>
                        <span className="block text-[11px] text-[var(--color-fg-dim)]">
                          {c.gstin ? <span className="font-mono">{c.gstin}</span> : "No GSTIN on file"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--color-fg-dim)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--color-fg-dim)]">
          Are you the accountant?{" "}
          <Link href="/" className="text-[var(--color-brand)] hover:underline">Go to the firm workspace</Link>
        </p>
      </div>
    </div>
  );
}
