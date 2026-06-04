-- ============================================================
-- LedgerOS — accounting dataset: reference data, validation,
-- and the chart of accounts (the "ledger" in LedgerOS).
-- ============================================================
-- Reference tables (state_code, gst_rate, hsn_code) are GLOBAL — not
-- firm-scoped. They're public, non-sensitive lookup data, so RLS is on
-- with a read-to-everyone policy. chart_of_accounts IS firm-scoped.
-- ============================================================

-- ---------- GSTIN / PAN validators ----------
-- IMMUTABLE so they're usable in CHECK constraints and indexes.
-- PAN:   AAAAA9999A   (5 letters, 4 digits, 1 letter)
-- GSTIN: 99AAAAA9999A1Z9  (2-digit state + 10-char PAN + entity + 'Z' + checksum)
create or replace function public.is_valid_pan(p text)
returns boolean language sql immutable as $$
  select p ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
$$;

create or replace function public.is_valid_gstin(g text)
returns boolean language sql immutable as $$
  select g ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$'
$$;

-- Tighten the client table now that validators exist (allow NULL = unknown).
alter table public.client
  add constraint client_pan_chk   check (pan   is null or public.is_valid_pan(pan)),
  add constraint client_gstin_chk check (gstin is null or public.is_valid_gstin(gstin));

-- ---------- state_code (GST state codes — first 2 digits of a GSTIN) ----------
create table public.state_code (
  code  text primary key,          -- '27'
  name  text not null,             -- 'Maharashtra'
  is_active boolean not null default true  -- false for legacy/merged codes
);

insert into public.state_code (code, name, is_active) values
  ('01','Jammu and Kashmir',true),
  ('02','Himachal Pradesh',true),
  ('03','Punjab',true),
  ('04','Chandigarh',true),
  ('05','Uttarakhand',true),
  ('06','Haryana',true),
  ('07','Delhi',true),
  ('08','Rajasthan',true),
  ('09','Uttar Pradesh',true),
  ('10','Bihar',true),
  ('11','Sikkim',true),
  ('12','Arunachal Pradesh',true),
  ('13','Nagaland',true),
  ('14','Manipur',true),
  ('15','Mizoram',true),
  ('16','Tripura',true),
  ('17','Meghalaya',true),
  ('18','Assam',true),
  ('19','West Bengal',true),
  ('20','Jharkhand',true),
  ('21','Odisha',true),
  ('22','Chhattisgarh',true),
  ('23','Madhya Pradesh',true),
  ('24','Gujarat',true),
  ('25','Daman and Diu',false),                -- legacy; merged into 26 (2020)
  ('26','Dadra and Nagar Haveli and Daman and Diu',true),
  ('27','Maharashtra',true),
  ('28','Andhra Pradesh (Old)',false),         -- legacy; pre-Telangana split
  ('29','Karnataka',true),
  ('30','Goa',true),
  ('31','Lakshadweep',true),
  ('32','Kerala',true),
  ('33','Tamil Nadu',true),
  ('34','Puducherry',true),
  ('35','Andaman and Nicobar Islands',true),
  ('36','Telangana',true),
  ('37','Andhra Pradesh',true),
  ('38','Ladakh',true),
  ('97','Other Territory',true),
  ('99','Centre Jurisdiction',true);

-- ---------- gst_rate (standard GST slabs) ----------
create table public.gst_rate (
  rate  numeric(5,2) primary key,  -- 18.00
  label text not null,             -- '18%'
  note  text
);

insert into public.gst_rate (rate, label, note) values
  (0.00,  '0%',     'Exempt / nil-rated (most unprocessed food, etc.)'),
  (0.25,  '0.25%',  'Rough precious/semi-precious stones'),
  (1.50,  '1.5%',   'Cut & polished diamonds'),
  (3.00,  '3%',     'Gold, silver, jewellery'),
  (5.00,  '5%',     'Essential goods, transport, small restaurants'),
  (12.00, '12%',    'Standard merit rate'),
  (18.00, '18%',    'Standard rate (most goods & services)'),
  (28.00, '28%',    'Luxury / sin goods (often + cess)');

-- ---------- hsn_code (starter subset — extend from CBIC master later) ----------
create table public.hsn_code (
  code        text primary key,            -- '998314'
  description text not null,
  kind        text not null default 'HSN' check (kind in ('HSN','SAC')),
  gst_rate    numeric(5,2) references public.gst_rate(rate)
);

-- A small, common set so classification + the COA mapping work day one.
-- This is NOT the full CBIC master (thousands of codes) — loadable later.
insert into public.hsn_code (code, description, kind, gst_rate) values
  ('1006',   'Rice',                                       'HSN', 0.00),
  ('0401',   'Milk and cream',                             'HSN', 0.00),
  ('1905',   'Bread, pastry, biscuits',                    'HSN', 18.00),
  ('2106',   'Food preparations n.e.s.',                   'HSN', 18.00),
  ('3004',   'Medicaments (packaged)',                     'HSN', 12.00),
  ('3304',   'Beauty / cosmetics preparations',            'HSN', 18.00),
  ('4820',   'Registers, account books, notebooks',        'HSN', 18.00),
  ('6109',   'T-shirts, singlets (knitted)',               'HSN', 5.00),
  ('6403',   'Footwear with leather uppers',               'HSN', 18.00),
  ('7308',   'Structures of iron or steel',                'HSN', 18.00),
  ('8471',   'Computers & data-processing units',          'HSN', 18.00),
  ('8517',   'Telephones / smartphones',                   'HSN', 18.00),
  ('8703',   'Motor cars',                                 'HSN', 28.00),
  ('9403',   'Furniture',                                  'HSN', 18.00),
  -- Services (SAC)
  ('9954',   'Construction services',                      'SAC', 18.00),
  ('996511', 'Road transport of goods',                    'SAC', 5.00),
  ('998212', 'Legal services',                             'SAC', 18.00),
  ('998221', 'Accounting & bookkeeping services',          'SAC', 18.00),
  ('998314', 'IT design & development services',           'SAC', 18.00),
  ('998361', 'Advertising services',                       'SAC', 18.00);

-- ---------- chart_of_accounts (firm-scoped — the ledger backbone) ----------
create type public.account_type as enum
  ('asset', 'liability', 'equity', 'income', 'expense');

create table public.chart_of_accounts (
  id         uuid                primary key default gen_random_uuid(),
  firm_id    uuid                not null references public.firm(id) on delete cascade,
  code       text                not null,        -- '1200'
  name       text                not null,        -- 'Sundry Debtors'
  type       public.account_type not null,
  parent_id  uuid                references public.chart_of_accounts(id) on delete set null,
  is_group   boolean             not null default false,  -- group header vs postable ledger
  created_at timestamptz         not null default now(),
  updated_at timestamptz         not null default now(),
  unique (firm_id, code)
);
create index coa_firm_idx   on public.chart_of_accounts (firm_id);
create index coa_parent_idx on public.chart_of_accounts (parent_id);

create trigger chart_of_accounts_touch before update on public.chart_of_accounts
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
-- Reference tables: world-readable (anon + authenticated), no writes via API.
alter table public.state_code enable row level security;
alter table public.gst_rate   enable row level security;
alter table public.hsn_code   enable row level security;

create policy state_code_read on public.state_code for select using (true);
create policy gst_rate_read   on public.gst_rate   for select using (true);
create policy hsn_code_read   on public.hsn_code   for select using (true);

-- Chart of accounts: firm-scoped, same pattern as the rest.
alter table public.chart_of_accounts enable row level security;
create policy coa_firm_all on public.chart_of_accounts
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());
