-- Run this in the Supabase SQL Editor, after schema.sql.
--
-- Why: the first version stored the whole pipeline and the whole imported
-- directory as single JSON blobs in kv_store. That works for a handful of
-- contacts, but breaks down for a multi-thousand-row spreadsheet import —
-- there's no way to tell two imports apart, no way to delete just one of
-- them, and a single giant blob is more fragile to sync than normal rows.
-- These three tables replace that for both the pipeline and the directory.
-- kv_store itself is left in place (still used for one small "have we
-- seeded the default contacts yet" flag) — nothing to migrate away from it.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  company text default '',
  country text default '',
  platform text default 'Other',
  handle text default '',
  type text default 'Founder',
  stage_focus text default 'N/A',
  status text default 'Not contacted',
  last_contact date,
  next_follow_up date,
  notes text default '',
  created_at timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "individuals manage their own contacts"
  on public.contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.directory_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  row_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.directory_batches enable row level security;

create policy "individuals manage their own batches"
  on public.directory_batches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.directory_investors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.directory_batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  raw_type text default '',
  city text default '',
  country text default '',
  website text default '',
  linkedin text default '',
  email text default '',
  stages text default '',
  industry_focus text default '',
  geo_focus text default '',
  min_investment numeric default 0,
  max_investment numeric default 0,
  notes text default ''
);

alter table public.directory_investors enable row level security;

create policy "individuals manage their own directory rows"
  on public.directory_investors
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists directory_investors_batch_idx on public.directory_investors (batch_id);
create index if not exists directory_investors_user_idx on public.directory_investors (user_id);
