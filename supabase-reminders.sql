-- ============================================
-- COURSE REMINDERS — run once in the Supabase SQL Editor
-- Each signed-in user can create email or text reminders for any course.
-- Users can only see and change their own reminders (Row Level Security).
-- The sender looks up the user's verified email/phone at send time,
-- so reminders can never be pointed at someone else.
-- ============================================

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  course_name text not null,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  remind_at timestamptz not null,
  message text not null default '' check (char_length(message) <= 300),
  sent boolean not null default false,
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists reminders_due_idx on reminders (remind_at) where sent = false;

alter table reminders enable row level security;

drop policy if exists "Own reminders: read" on reminders;
drop policy if exists "Own reminders: add" on reminders;
drop policy if exists "Own reminders: delete" on reminders;

create policy "Own reminders: read" on reminders
  for select to authenticated using (auth.uid() = user_id);

create policy "Own reminders: add" on reminders
  for insert to authenticated with check (auth.uid() = user_id and sent = false);

create policy "Own reminders: delete" on reminders
  for delete to authenticated using (auth.uid() = user_id);

-- No update policy: only the sender (service role) marks reminders as sent.

-- Cap each user at 50 pending reminders to prevent abuse.
create or replace function reminders_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reminders where user_id = new.user_id and sent = false) >= 50 then
    raise exception 'You can have up to 50 upcoming reminders';
  end if;
  return new;
end $$;

drop trigger if exists reminders_limit_trg on reminders;
create trigger reminders_limit_trg before insert on reminders
  for each row execute function reminders_limit();


-- ============================================
-- SCHEDULE — run AFTER deploying the send-reminders function (see SETUP.md).
-- Requires the pg_cron and pg_net extensions (Database → Extensions).
-- Replace YOUR_PROJECT_REF and YOUR_CRON_SECRET, then run this part.
-- ============================================

-- select cron.schedule(
--   'send-reminders',
--   '* * * * *',  -- every minute
--   $$
--   select net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
--     headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET"}'::jsonb
--   );
--   $$
-- );
