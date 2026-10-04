-- ============================================
-- TEAMS MIGRATION — run once in the Supabase SQL Editor
-- Adds a team to each quarter so one dashboard can hold several teams.
-- Existing quarters become Seattle Melt quarters automatically.
-- ============================================

alter table quarters add column if not exists team text default 'seattle-melt';
update quarters set team = 'seattle-melt' where team is null;
