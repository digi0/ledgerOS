-- Canonical vouchers: the neutral double-entry layer between parsed documents
-- and every export target (Tally / Busy / GSTN JSON / CSV). See
-- docs/integration-pipeline.md. A voucher is DERIVED from a document
-- deterministically; this table persists the derivation so export_state
-- (per-target dedup — "already pushed to Tally?") has a home and survives
-- re-derivation.
--
-- lines/gst/party are jsonb (same pattern as document.extracted_fields): a
-- voucher's lines are always read as a unit, never queried column-wise.

create table if not exists public.voucher (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references public.firm(id) on delete cascade,
  client_id            uuid references public.client(id) on delete set null,

  -- Provenance: one voucher per source document. Re-deriving upserts on this
  -- key, so a fixed/re-parsed doc regenerates its voucher without duplicating.
  source_document_id   uuid not null references public.document(id) on delete cascade,

  kind                 text not null
                         check (kind in ('purchase','sales','payment','receipt','contra','journal')),
  date                 text not null,            -- ISO "YYYY-MM-DD"
  narration            text,
  reference            text,                     -- invoice / cheque / challan no

  party                jsonb,                    -- { name, gstin }
  lines                jsonb not null default '[]'::jsonb,  -- [{ ledger, amount, gst_rate? }]
  gst                  jsonb,                    -- { taxable, cgst, sgst, igst, cess }
  warnings             jsonb not null default '[]'::jsonb,

  -- Per-target export ledger: { tally: { exported_at, masterid }, csv: {...} }.
  -- Keyed by target so re-export into one system never double-posts.
  export_state         jsonb not null default '{}'::jsonb,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (source_document_id)
);

create index if not exists voucher_firm_client
  on public.voucher (firm_id, client_id, date);

-- RLS: firm-scoped (same policy shape as gstr2b_entry / form26as_entry).
alter table public.voucher enable row level security;

create policy "firm members can manage vouchers"
  on public.voucher
  for all
  using (
    firm_id in (
      select firm_id from public.profiles where user_id = auth.uid()
    )
  );
