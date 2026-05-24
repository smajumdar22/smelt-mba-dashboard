-- ============================================
-- SEATTLE MELT MBA TRACKER — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Quarters
create table if not exists quarters (
  id uuid default gen_random_uuid() primary key,
  label text not null,
  active boolean default false,
  created_at timestamptz default now()
);

-- Courses
create table if not exists courses (
  id uuid default gen_random_uuid() primary key,
  quarter_id uuid references quarters(id) on delete cascade,
  name text not null,
  code text not null,
  color text default '#4ef0c0',
  canvas_url text default '',
  created_at timestamptz default now()
);

-- Assignments & Discussions
create table if not exists assignments (
  id uuid default gen_random_uuid() primary key,
  quarter_id uuid references quarters(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  name text not null,
  type text default 'assignment', -- 'assignment' | 'discussion'
  due_date date,
  priority text default 'medium', -- 'high' | 'medium' | 'low'
  assigned_to text[] default '{}',
  done boolean default false,
  notes text default '',
  canvas_url text default '',
  created_at timestamptz default now()
);

-- Meetings
create table if not exists meetings (
  id uuid default gen_random_uuid() primary key,
  quarter_id uuid references quarters(id) on delete cascade,
  name text not null,
  day text not null,
  time text not null,
  link text default '',
  recurring boolean default true,
  created_at timestamptz default now()
);

-- ── Enable Row Level Security (public read/write for team use) ──
alter table quarters enable row level security;
alter table courses enable row level security;
alter table assignments enable row level security;
alter table meetings enable row level security;

-- Allow anyone with the URL to read/write (team-only app, no auth needed)
create policy "Public access" on quarters for all using (true) with check (true);
create policy "Public access" on courses for all using (true) with check (true);
create policy "Public access" on assignments for all using (true) with check (true);
create policy "Public access" on meetings for all using (true) with check (true);

-- ── Enable Realtime ──
alter publication supabase_realtime add table quarters;
alter publication supabase_realtime add table courses;
alter publication supabase_realtime add table assignments;
alter publication supabase_realtime add table meetings;

-- ── Seed: default quarter ──
insert into quarters (label, active) values ('Spring 2026', true);
