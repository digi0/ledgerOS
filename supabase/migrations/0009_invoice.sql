-- Generated invoices — the business-side entry point. Unlike `document` (parsed
-- PDFs the CA receives), an invoice is structured AT BIRTH: the CA (later, the
-- client) raises it here, we render a GST-compliant PDF, and the same data feeds
-- the outward register + GSTR-1 with zero extraction. See docs/integration-pipeline.md.
--
-- The client is the SUPPLIER on their own outward invoices. Supplier + buyer
-- details are SNAPSHOTTED on the invoice so historical invoices never change if
-- the client record is later edited (standard invoicing practice + legal).

create table if not exists public.invoice (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references public.firm(id) on delete cascade,
  client_id       uuid not null references public.client(id) on delete cascade, -- the supplier

  -- Numbering: consecutive serial, unique per client per financial year (legal).
  invoice_no      text not null,
  fy              text not null,            -- "2026-27" (Apr–Mar)
  seq             int  not null,            -- numeric sequence within (client, fy)
  date            text not null,            -- ISO "YYYY-MM-DD"

  -- Supplier snapshot (the client, as it stood when issued)
  supplier_name    text not null,
  supplier_gstin   text,
  supplier_state   text,                    -- 2-digit GST state code
  supplier_address text,

  -- Recipient / buyer
  buyer_name       text not null,
  buyer_gstin      text,                    -- null ⇒ B2C (unregistered)
  buyer_address    text,
  place_of_supply  text not null,           -- 2-digit GST state code
  reverse_charge   boolean not null default false,

  -- Totals (computed from lines; stored for display + filing)
  taxable   numeric not null default 0,
  cgst      numeric not null default 0,
  sgst      numeric not null default 0,
  igst      numeric not null default 0,
  cess      numeric not null default 0,
  total     numeric not null default 0,

  status    text not null default 'issued' check (status in ('draft','issued','cancelled')),
  notes     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (client_id, fy, seq),
  unique (client_id, invoice_no)
);

create index if not exists invoice_firm_client on public.invoice (firm_id, client_id, date);

create table if not exists public.invoice_line (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoice(id) on delete cascade,
  line_no     int  not null,
  description text not null,
  hsn_sac     text,
  qty         numeric not null default 1,
  unit        text,                          -- UQC, e.g. "NOS", "MTR"
  rate        numeric not null default 0,    -- price per unit (pre-tax)
  taxable     numeric not null default 0,    -- qty × rate
  gst_rate    numeric not null default 0,    -- %
  cgst        numeric not null default 0,
  sgst        numeric not null default 0,
  igst        numeric not null default 0,
  cess        numeric not null default 0,

  unique (invoice_id, line_no)
);

create index if not exists invoice_line_invoice on public.invoice_line (invoice_id);

-- RLS: firm-scoped (same policy shape as the other domain tables).
alter table public.invoice enable row level security;
alter table public.invoice_line enable row level security;

create policy "firm members manage invoices"
  on public.invoice for all
  using (firm_id in (select firm_id from public.profiles where user_id = auth.uid()));

-- invoice_line inherits scope through its parent invoice.
create policy "firm members manage invoice lines"
  on public.invoice_line for all
  using (
    invoice_id in (
      select id from public.invoice
      where firm_id in (select firm_id from public.profiles where user_id = auth.uid())
    )
  );
