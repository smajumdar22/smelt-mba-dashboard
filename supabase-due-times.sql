-- ============================================
-- DUE TIMES + "BEFORE DUE" REMINDERS — run once in the Supabase SQL Editor,
-- after the other reminder SQL files.
--
-- 1. Assignments get an optional due time (no time = due by 11:59 PM).
-- 2. Reminders can be set relative to the due time ("1 day before",
--    "3 hours before"...). When someone changes an assignment's due date or
--    time, those reminders move with it automatically.
-- ============================================

alter table assignments add column if not exists due_time time;

-- Minutes before the due time; null = a reminder at a fixed date/time.
alter table reminders add column if not exists offset_minutes int
  check (offset_minutes is null or offset_minutes between 0 and 60 * 24 * 60);

create or replace function shift_relative_reminders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.due_date is distinct from old.due_date or new.due_time is distinct from old.due_time then
    if new.due_date is null then
      -- No due date any more: relative reminders have nothing to count back from.
      delete from reminders where assignment_id = new.id and offset_minutes is not null and sent = false;
    else
      with t as (
        select r.id,
               ((new.due_date + coalesce(new.due_time, time '23:59'))
                 at time zone coalesce(st.timezone, 'America/Los_Angeles'))
               - make_interval(mins => r.offset_minutes) as at
        from reminders r
        left join reminder_settings st on st.user_id = r.user_id
        where r.assignment_id = new.id and r.offset_minutes is not null
      )
      update reminders r
      set remind_at  = t.at,
          -- still ahead: re-arm it; already passed: skip it instead of sending late
          sent       = t.at <= now(),
          sent_at    = case when t.at <= now() then coalesce(r.sent_at, now()) else null end,
          attempts   = case when t.at <= now() then r.attempts else 0 end,
          last_error = case when t.at <= now() and not r.sent then 'Skipped: due date changed' else null end
      from t
      where r.id = t.id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists shift_relative_reminders_trg on assignments;
create trigger shift_relative_reminders_trg after update of due_date, due_time on assignments
  for each row execute function shift_relative_reminders();
