-- 0005 — client service subscriptions
-- Each client can be enrolled in multiple CA services (GST, TDS, ITR, etc.).
-- Stored as a text array on the client row; no separate table needed until
-- service-specific metadata (rate, enrolled date, etc.) is required.
alter table public.client
  add column if not exists services text[] not null default '{}';
