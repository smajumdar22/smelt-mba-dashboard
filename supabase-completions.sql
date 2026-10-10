-- ============================================
-- PER-PERSON COMPLETION — run once in the Supabase SQL Editor.
-- Safe to run even if the table already exists.
-- Tasks with 2+ assignees are done only when every assignee has ticked their part.
-- ============================================

create table if not exists assignment_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  person text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (assignment_id, person)
);

-- Needed for "upsert" if the table was created earlier without it.
create unique index if not exists assignment_completions_assignment_person
  on assignment_completions (assignment_id, person);

alter table assignment_completions enable row level security;
drop policy if exists "Public access" on assignment_completions;
create policy "Public access" on assignment_completions for all using (true) with check (true);

-- Live updates when a teammate ticks their part.
do $$ begin
  alter publication supabase_realtime add table assignment_completions;
exception when duplicate_object then null;
end $$;
