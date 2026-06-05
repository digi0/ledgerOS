-- 0003 — create profiles at the source (auth trigger), not app-side.
--
-- Bug this fixes: signUp() only upserted the profile when Supabase returned
-- an instant session. With email confirmation ON, there was no session, the
-- upsert was skipped, and the confirmed user had no profile → no firm →
-- every RLS check failed ("new row violates row-level security policy").
-- A trigger on auth.users can't miss, whatever the confirmation flow.

-- 1. The FK that was missing (a junk profile row proved it): profiles must
--    point at a real auth user, and vanish when that user is deleted.
alter table public.profiles
  add constraint profiles_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- 2. Auto-create the profile on signup. Pilot onboarding = everyone joins
--    the demo firm (Sharma & Associates); real "create your firm" comes later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, firm_id, full_name, email)
  values (
    new.id,
    '11111111-1111-1111-1111-111111111111',
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), ''),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
