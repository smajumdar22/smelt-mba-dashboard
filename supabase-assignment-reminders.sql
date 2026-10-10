-- ============================================
-- ASSIGNMENT REMINDERS — run once in the Supabase SQL Editor,
-- after supabase-reminders.sql.
--
-- 1. Automatic due-date reminders: every signed-in person gets a daily
--    reminder for each open assignment, starting 7 days before it's due
--    through the due date. Each person can change how many days before,
--    what times of day (add more times for more reminders), email/text,
--    or turn it off.
-- 2. Extra one-off reminders for a single assignment (same as course
--    reminders, now linked to an assignment).
-- ============================================

-- ── Per-person settings ──
create table if not exists reminder_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  days_before int not null default 7 check (days_before between 0 and 30),
  times text[] not null default '{09:00}'
    check (cardinality(times) between 1 and 12),
  by_email boolean not null default true,
  by_sms boolean not null default false,
  only_mine boolean not null default false,  -- only assignments assigned to member_name
  member_name text,                          -- their name as shown in the team list
  timezone text not null default 'America/Los_Angeles',
  updated_at timestamptz not null default now()
);

alter table reminder_settings enable row level security;

drop policy if exists "Own settings: read" on reminder_settings;
drop policy if exists "Own settings: add" on reminder_settings;
drop policy if exists "Own settings: change" on reminder_settings;

create policy "Own settings: read" on reminder_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "Own settings: add" on reminder_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own settings: change" on reminder_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Send log so each scheduled reminder goes out once ──
-- Only the sender (service role) uses this; no policies = no client access.
create table if not exists reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,      -- e.g. '2026-10-08 09:00'
  channel text not null,   -- 'email' | 'sms'
  sent_at timestamptz not null default now(),
  primary key (user_id, slot, channel)
);
alter table reminder_log enable row level security;

-- ── One-off reminders can now point at an assignment ──
alter table reminders add column if not exists assignment_id uuid
  references assignments(id) on delete cascade;
