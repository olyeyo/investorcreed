-- Run after schema_v2_directory.sql. Logs every reminder email the app sends
-- to olyeyo3@gmail.com when a contact is marked contacted/messaged — this is
-- the "track the send" half of email tracking. Tracking replies/opens would
-- need actual inbound email infrastructure (domain + webhook), which is a
-- separate, bigger setup — not covered here. The "Replied" status in your
-- pipeline remains the manual way to record that side for now.

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  contact_name text not null,
  trigger_type text not null,
  sent_ok boolean not null default true,
  error text,
  sent_at timestamptz not null default now()
);

alter table public.email_log enable row level security;

create policy "individuals manage their own email log"
  on public.email_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
