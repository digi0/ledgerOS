-- ============================================================
-- LedgerOS — initial schema (firm-scoped multi-tenant)
-- ============================================================
-- Model: staff at a CA firm share access to that firm's clients and
-- documents (vs medvault's per-user model). Every firm-owned row carries
-- firm_id; RLS makes a row visible iff its firm_id = current_firm_id().
--
-- The firm link for a user lives in `profiles` (one row per auth user).
-- During the build/seed phase the service_role key (serverAdmin()) bypasses
-- RLS to insert the demo firm's data; the anon/cookie client returns zero
-- rows until a user is signed in and attached to a firm.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- firm (the tenant — a CA practice) ----------
create table public.firm (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  slug       text        unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profiles (auth user → firm + role) ----------
create type public.firm_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  user_id    uuid             primary key,  -- = auth.users.id
  firm_id    uuid             references public.firm(id) on delete set null,
  full_name  text             not null default '',
  email      text,
  role       public.firm_role not null default 'member',
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now()
);
create index profiles_firm_idx on public.profiles (firm_id);

-- The firm_id of the current auth user. SECURITY DEFINER so RLS policies
-- can call it without recursing through profiles' own RLS.
create or replace function public.current_firm_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select firm_id from public.profiles where user_id = auth.uid()
$$;

-- ---------- client ----------
create table public.client (
  id             uuid        primary key default gen_random_uuid(),
  firm_id        uuid        not null references public.firm(id) on delete cascade,
  name           text        not null,
  gstin          text,
  pan            text,
  primary_email  text,
  primary_domain text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (firm_id, gstin)
);
create index client_firm_idx   on public.client (firm_id);
create index client_gstin_idx  on public.client (gstin);
create index client_domain_idx on public.client (primary_domain);

-- ---------- email_account (a connected inbox) ----------
create type public.email_provider as enum ('gmail', 'outlook', 'imap');

create table public.email_account (
  id              uuid                  primary key default gen_random_uuid(),
  firm_id         uuid                  not null references public.firm(id) on delete cascade,
  provider        public.email_provider not null,
  email_address   text                  not null,
  credentials     jsonb                 not null default '{}'::jsonb, -- encrypt at rest in prod
  last_history_id text,
  is_active       boolean               not null default true,
  created_at      timestamptz           not null default now(),
  updated_at      timestamptz           not null default now()
);
create index email_account_firm_idx on public.email_account (firm_id);

-- ---------- ingested_email (one fetched message) ----------
create table public.ingested_email (
  id                  uuid        primary key default gen_random_uuid(),
  firm_id             uuid        not null references public.firm(id) on delete cascade,
  email_account_id    uuid        not null references public.email_account(id) on delete cascade,
  provider_message_id text        not null,
  thread_id           text,
  sender              text,
  subject             text,
  received_at         timestamptz,
  raw_meta            jsonb       not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (email_account_id, provider_message_id)
);
create index ingested_email_firm_idx   on public.ingested_email (firm_id);
create index ingested_email_sender_idx on public.ingested_email (sender);

-- ---------- document (the core object) ----------
create type public.document_status as enum
  ('received', 'extracted', 'classified', 'matched', 'ready', 'failed');

create type public.document_classification as enum
  ('unknown', 'invoice', 'bank_statement', 'notice', 'receipt', 'tds_certificate', 'other');

-- Staff workflow state in the inbox, separate from the pipeline status.
create type public.handling_status as enum ('new', 'in_progress', 'handled');

create table public.document (
  id                        uuid                            primary key default gen_random_uuid(),
  firm_id                   uuid                            not null references public.firm(id) on delete cascade,
  client_id                 uuid                            references public.client(id) on delete set null,
  source_email_id           uuid                            references public.ingested_email(id) on delete set null,
  filename                  text                            not null,
  mime_type                 text,
  size_bytes                integer,
  storage_path              text                            not null, -- path within the Storage bucket
  ocr_text                  text,
  classification            public.document_classification  not null default 'unknown',
  classification_confidence real,
  extracted_fields          jsonb                           not null default '{}'::jsonb,
  status                    public.document_status          not null default 'received',
  handling                  public.handling_status          not null default 'new',
  error                     text,
  -- generated full-text column over filename + extracted text (inbox search)
  fts tsvector generated always as (
    to_tsvector('english', coalesce(filename, '') || ' ' || coalesce(ocr_text, ''))
  ) stored,
  created_at                timestamptz                     not null default now(),
  updated_at                timestamptz                     not null default now()
);
create index document_firm_created_idx on public.document (firm_id, created_at desc);
create index document_client_idx       on public.document (client_id);
create index document_status_idx       on public.document (status);
create index document_handling_idx     on public.document (handling);
create index document_fts_idx          on public.document using gin (fts);

-- ---------- updated_at trigger on mutable tables ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['firm', 'profiles', 'client', 'email_account', 'document'] loop
    execute format(
      'create trigger %1$s_touch before update on public.%1$s
         for each row execute function public.touch_updated_at();', t);
  end loop;
end;
$$;

-- ============================================================
-- RLS — firm-scoped. Enforces the moment auth is wired (rung 5).
-- ============================================================
alter table public.firm           enable row level security;
alter table public.profiles       enable row level security;
alter table public.client         enable row level security;
alter table public.email_account  enable row level security;
alter table public.ingested_email enable row level security;
alter table public.document       enable row level security;

-- firm: members can see their own firm
create policy firm_member_select on public.firm
  for select using (id = public.current_firm_id());

-- profiles: a user fully controls their own row; can read firm-mates
create policy profiles_self_all on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_firmmates_select on public.profiles
  for select using (firm_id = public.current_firm_id());

-- firm-scoped tables: full access within the caller's firm
create policy client_firm_all on public.client
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

create policy email_account_firm_all on public.email_account
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

create policy ingested_email_firm_all on public.ingested_email
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

create policy document_firm_all on public.document
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());
