"use client";

import { useRouter } from "next/navigation";

interface Props {
  clients: { id: string; name: string }[];
  currentClient: string;
  currentFy: string;
  currentQuarter: string;
  fyOptions: { value: string; label: string }[];
}

export default function TdsRegisterFilters({
  clients,
  currentClient,
  currentFy,
  currentQuarter,
  fyOptions,
}: Props) {
  const router = useRouter();

  const push = (client: string, fy: string, quarter: string) => {
    const p = new URLSearchParams();
    if (client) p.set("client", client);
    if (fy) p.set("fy", fy);
    if (quarter) p.set("quarter", quarter);
    router.push(`/tds/register${p.toString() ? `?${p}` : ""}`);
  };

  const sel =
    "rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentClient}
        onChange={(e) => push(e.target.value, currentFy, currentQuarter)}
        className={sel}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={currentFy}
        onChange={(e) => push(currentClient, e.target.value, currentQuarter)}
        className={sel}
      >
        <option value="">All years</option>
        {fyOptions.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        value={currentQuarter}
        onChange={(e) => push(currentClient, currentFy, e.target.value)}
        className={sel}
      >
        <option value="">All quarters</option>
        <option value="Q1">Q1 (Apr–Jun)</option>
        <option value="Q2">Q2 (Jul–Sep)</option>
        <option value="Q3">Q3 (Oct–Dec)</option>
        <option value="Q4">Q4 (Jan–Mar)</option>
      </select>
    </div>
  );
}
