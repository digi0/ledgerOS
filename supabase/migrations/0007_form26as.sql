-- Form 26AS entries: one row per TDS deduction line in an uploaded TRACES
-- annual tax statement. The reconciliation engine joins these against TDS
-- register rows (tds_certificate documents) for the same client + FY.

create table if not exists public.form26as_entry (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references public.firm(id) on delete cascade,
  client_id        uuid references public.client(id) on delete set null,

  fy               text not null,          -- "2024-25" (Indian FY April–March)
  part             text not null default 'A', -- "A" = non-salary, "B" = salary

  -- Deductor (the entity that deducted and deposited TDS)
  deductor_tan     text,                   -- 10-char TAN e.g. MUMA12345B
  deductor_name    text,

  -- TDS details per line in the 26AS
  section          text,                   -- "194J", "194C", "192" …
  quarter          text,                   -- "Q1"|"Q2"|"Q3"|"Q4" (may be empty if not present in source)
  amount_paid      numeric not null default 0,
  tds_deducted     numeric not null default 0,
  booking_status   text,                   -- "F" (Final / deposited), "P" (Pending)

  created_at       timestamptz not null default now()
);

create index if not exists form26as_firm_client_fy
  on public.form26as_entry (firm_id, client_id, fy);

-- RLS: firm-scoped (same pattern as gstr2b_entry)
alter table public.form26as_entry enable row level security;

create policy "firm members can manage 26as entries"
  on public.form26as_entry
  for all
  using (
    firm_id in (
      select firm_id from public.profiles where user_id = auth.uid()
    )
  );
