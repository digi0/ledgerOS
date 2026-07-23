-- 0010 — real multi-tenancy: own-firm onboarding + clean cutover.
--
-- The gap this closes: the app shipped with auth OFF (service-role client,
-- RLS bypassed) AND a signup trigger (0003) that hardcoded every new user into
-- ONE shared demo firm. Result: every user saw every other user's clients and
-- documents. RLS itself was correct — it was bypassed, and everyone was in the
-- same firm. This migration makes each signup its OWN firm (owner), migrates
-- existing users to their own firms, and wipes the shared demo data.
--
-- Pair this with NEXT_PUBLIC_AUTH_ENABLED=true (env + Vercel) so reads/writes
-- go through the cookie-bound client and RLS actually applies.

-- ── 1. New onboarding: a signup creates its own firm and joins it as owner ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
  v_base    text;
  v_name    text;
  v_slug    text;
begin
  -- Firm name: an explicit firm_name from signup, else "<name>'s Practice".
  v_base := coalesce(
    nullif(new.raw_user_meta_data->>'firm_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );
  v_name := coalesce(nullif(new.raw_user_meta_data->>'firm_name', ''), v_base || '''s Practice');

  -- Unique slug: slugified base + short random suffix (firm.slug is unique).
  v_slug := lower(regexp_replace(coalesce(v_base, 'firm'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'firm'; end if;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.firm (name, slug) values (v_name, v_slug) returning id into v_firm_id;

  insert into public.profiles (user_id, firm_id, full_name, email, role)
  values (
    new.id,
    v_firm_id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), ''),
    new.email,
    'owner'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ── 2. Migrate existing users off the shared demo firm — each gets their own ──
do $$
declare
  r         record;
  v_firm_id uuid;
  v_name    text;
  v_slug    text;
begin
  for r in select user_id, full_name, email from public.profiles loop
    v_name := coalesce(nullif(r.full_name, ''), split_part(r.email, '@', 1), 'My') || '''s Practice';
    v_slug := 'firm-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    insert into public.firm (name, slug) values (v_name, v_slug) returning id into v_firm_id;
    update public.profiles set firm_id = v_firm_id, role = 'owner' where user_id = r.user_id;
  end loop;
end $$;

-- ── 3. Clean cutover: delete the demo firm. FK cascades wipe its clients,
--    documents, invoices, vouchers, reconciliation rows and chart of accounts.
--    Global reference tables (state_code / gst_rate / hsn_code) have no firm_id
--    and are untouched. Existing users were repointed in step 2, so none is
--    orphaned by this delete.
delete from public.firm where id = '11111111-1111-1111-1111-111111111111';
