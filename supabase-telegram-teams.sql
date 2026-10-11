-- ============================================
-- TELEGRAM REMINDERS + TEAMS CHANNEL POSTS — run once in the Supabase
-- SQL Editor, after the other reminder SQL files.
--
-- Telegram:
-- People connect the SMELT Telegram bot from the app. The app creates a
-- one-time code; the person opens the bot with it, and the bot links their
-- Telegram chat to their account. Only the chat id and Telegram display
-- name are stored: never a phone number.
-- ============================================

-- Telegram as a reminder channel
alter table reminders drop constraint if exists reminders_channel_check;
alter table reminders add constraint reminders_channel_check
  check (channel in ('email', 'sms', 'telegram'));

alter table reminder_settings add column if not exists by_telegram boolean not null default false;

-- Which Telegram chat belongs to which account
create table if not exists telegram_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id bigint not null unique,
  display_name text,
  linked_at timestamptz not null default now()
);

alter table telegram_links enable row level security;
drop policy if exists "Own telegram link: read" on telegram_links;
drop policy if exists "Own telegram link: remove" on telegram_links;
create policy "Own telegram link: read" on telegram_links
  for select to authenticated using (auth.uid() = user_id);
create policy "Own telegram link: remove" on telegram_links
  for delete to authenticated using (auth.uid() = user_id);
-- No insert/update policy: only the bot (service role) creates links.

-- One-time codes used to connect (valid 15 minutes, single use)
create table if not exists telegram_link_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
alter table telegram_link_codes enable row level security;
-- No policies: the app gets codes only through the function below.

create or replace function create_telegram_link_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_code text;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;
  delete from telegram_link_codes where user_id = uid or expires_at < now();
  -- 48 random hex characters (Telegram allows up to 64 in a start link)
  new_code := replace(gen_random_uuid()::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 16);
  insert into telegram_link_codes (code, user_id) values (new_code, uid);
  return new_code;
end $$;

revoke all on function create_telegram_link_code() from public;
grant execute on function create_telegram_link_code() to authenticated;


-- ── Teams channel: one "due tomorrow" post per team per day ──
-- Only the sender uses this log; no policies = no app access.
create table if not exists teams_post_log (
  team text not null,
  day date not null,
  posted_at timestamptz not null default now(),
  primary key (team, day)
);
alter table teams_post_log enable row level security;
