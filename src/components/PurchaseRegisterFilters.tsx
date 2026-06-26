"use client";

import { useRouter } from "next/navigation";

interface Props {
  clients: { id: string; name: string }[];
  currentClient: string;
  currentPeriod: string;
  periods: { value: string; label: string }[];
}

export default function PurchaseRegisterFilters({
  clients,
  currentClient,
  currentPeriod,
  periods,
}: Props) {
  const router = useRouter();

  const push = (client: string, period: string) => {
    const p = new URLSearchParams();
    if (client) p.set("client", client);
    if (period) p.set("period", period);
    const qs = p.toString();
    router.push(`/purchase-register${qs ? `?${qs}` : ""}`);
  };

  const selectCls =
    "rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] text-[var(--color-fg)] focus:border-[var(--color-brand)] focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={currentClient}
        onChange={(e) => push(e.target.value, currentPeriod)}
        className={selectCls}
      >
        <option value="">All clients</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        value={currentPeriod}
        onChange={(e) => push(currentClient, e.target.value)}
        className={selectCls}
      >
        <option value="">All periods</option>
        {periods.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
