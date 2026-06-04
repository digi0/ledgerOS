"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { CLASSIFICATION_LABELS, type DocumentClassification } from "@/lib/types";

const CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as DocumentClassification[];

export default function InboxFilters({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const selectCls =
    "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] focus:border-[var(--color-brand)]";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", search.trim());
        }}
        className="relative flex-1 min-w-[240px]"
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-fg-dim)]"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filename or document text…"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-dim)] focus:border-[var(--color-brand)]"
        />
      </form>

      <select
        aria-label="Document type"
        value={params.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
        className={selectCls}
      >
        <option value="">All types</option>
        {CLASSIFICATIONS.map((c) => (
          <option key={c} value={c}>
            {CLASSIFICATION_LABELS[c]}
          </option>
        ))}
      </select>

      <select
        aria-label="Client"
        value={params.get("client") ?? ""}
        onChange={(e) => setParam("client", e.target.value)}
        className={selectCls}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
