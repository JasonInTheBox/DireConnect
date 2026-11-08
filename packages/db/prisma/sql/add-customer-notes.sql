-- Run once in the Supabase SQL editor BEFORE deploying the API that reads Customer.notes.
-- (Prisma selects every column, so the new API fails on customer routes until this column exists.)
-- Additive and nullable: existing rows and the current API keep working.

alter table public."Customer" add column if not exists "notes" text;

-- Check: should return one row.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'Customer' and column_name = 'notes';
