-- ============================================
-- GROUP / INDIVIDUAL — run once in the Supabase SQL Editor.
-- Adds an optional "Group or individual" field to assignments.
-- Existing assignments stay "Not set" until you edit them.
-- ============================================

alter table assignments add column if not exists work_type text
  check (work_type is null or work_type in ('individual', 'group'));
