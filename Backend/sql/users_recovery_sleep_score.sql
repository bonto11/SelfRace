-- Skóre spánku z hodiniek (0–100, napr. Garmin Sleep Score cez intervals.icu).
-- RLS sa nemení – pribúda len stĺpec. Sync z intervals.icu funguje aj bez
-- migrácie (stĺpec vynechá), skóre sa začne ukladať až po nej.

alter table public.users_recovery
  add column if not exists sleep_score smallint
  check (sleep_score is null or (sleep_score >= 0 and sleep_score <= 100));
