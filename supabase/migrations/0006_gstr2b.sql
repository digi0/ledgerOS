-- GSTR-2B entries: one row per supplier invoice line ingested from a
-- GSTR-2B JSON export. The reconciliation engine joins these against
-- the purchase register (document rows with classification='invoice').

create table if not exists public.gstr2b_entry (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firm(id) on delete cascade,
  client_id       uuid references public.client(id) on delete set null,
  period          text not null,           -- "YYYY-MM"  e.g. "2026-04"

  -- Supplier
  supplier_gstin  text not null,
  supplier_name   text,

  -- Invoice
  invoice_number  text not null,
  invoice_date    text,                    -- ISO "YYYY-MM-DD" when parseable
  invoice_value   numeric,

  -- Tax breakdown (summed across all line items in the JSON)
  taxable_value   numeric,
  cgst            numeric not null default 0,
  sgst            numeric not null default 0,
  igst            numeric not null default 0,
  cess            numeric not null default 0,

  itc_available   boolean not null default true,
  reverse_charge  boolean not null default false,

  created_at      timestamptz not null default now()
);

create index if not exists gstr2b_entry_firm_client_period
  on public.gstr2b_entry (firm_id, client_id, period);

create index if not exists gstr2b_entry_lookup
  on public.gstr2b_entry (firm_id, client_id, period, supplier_gstin, invoice_number);

-- RLS: firm-scoped
alter table public.gstr2b_entry enable row level security;

create policy "firm members can manage gstr2b entries"
  on public.gstr2b_entry
  for all
  using (
    firm_id in (
      select firm_id from public.profiles where user_id = auth.uid()
    )
  );
