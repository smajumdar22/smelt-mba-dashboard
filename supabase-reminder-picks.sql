-- ============================================
-- PICK WHICH ASSIGNMENTS REMIND YOU — run once in the Supabase SQL Editor,
-- after supabase-assignment-reminders.sql.
--
-- scope decides the default for each person:
--   'all'    every open assignment (default)
--   'mine'   only assignments assigned to member_name
--   'picked' only assignments they switch on
-- reminder_picks overrides that per assignment:
--   included = true  always remind me about this one
--   included = false never remind me about this one
-- ============================================

alter table reminder_settings add column if not exists scope text not null default 'all';
alter table reminder_settings drop constraint if exists reminder_settings_scope_check;
alter table reminder_settings add constraint reminder_settings_scope_check
  check (scope in ('all', 'mine', 'picked'));
update reminder_settings set scope = 'mine' where only_mine and scope = 'all';

create table if not exists reminder_picks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  included boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, assignment_id)
);

alter table reminder_picks enable row level security;

drop policy if exists "Own picks: read" on reminder_picks;
drop policy if exists "Own picks: add" on reminder_picks;
drop policy if exists "Own picks: change" on reminder_picks;
drop policy if exists "Own picks: delete" on reminder_picks;

create policy "Own picks: read" on reminder_picks
  for select to authenticated using (auth.uid() = user_id);
create policy "Own picks: add" on reminder_picks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own picks: change" on reminder_picks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own picks: delete" on reminder_picks
  for delete to authenticated using (auth.uid() = user_id);
