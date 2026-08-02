-- Run after schema_v3_email_log.sql.
-- Adds commitment/term-sheet tracking directly onto contacts, rather than a
-- separate table — a commitment is a property of a contact you're already
-- tracking, not a standalone entity, so this is the faster and simpler path.

alter table public.contacts
  add column if not exists commitment_status text not null default 'None',
  add column if not exists commitment_amount numeric not null default 0,
  add column if not exists target_close_date date;
