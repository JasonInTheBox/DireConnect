-- Run once in the Supabase SQL editor (and again after adding a new model).
--
-- Why: Supabase serves the public schema over its REST API to anyone holding the
-- publishable key, which ships in the web bundle. Today the anon role has no grants
-- on these tables (checked 2026-11-07: every table answers 401 / 42501), but a
-- dashboard change or a new table could quietly re-expose them.
--
-- Enabling RLS with no policies denies every row to the anon and authenticated
-- roles. The API and worker connect through Prisma as the table owner, which
-- bypasses RLS, so the app keeps working unchanged.

alter table public."Business" enable row level security;
alter table public."Customer" enable row level security;
alter table public."Campaign" enable row level security;
alter table public."CampaignRecipientSnapshot" enable row level security;
alter table public."MessageLog" enable row level security;

-- Belt and braces: the REST roles get no table privileges at all.
revoke all on public."Business", public."Customer", public."Campaign",
  public."CampaignRecipientSnapshot", public."MessageLog"
  from anon, authenticated;

-- Check: every row should say true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('Business', 'Customer', 'Campaign', 'CampaignRecipientSnapshot', 'MessageLog');
