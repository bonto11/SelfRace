-- Plán obdobia (advisor kostra na viac týždňov) je v users_preferences pod
-- kľúčom 'advisor.season_plan' – nová tabuľka netreba (zápis = vlastné riadky,
-- existujúce RLS). Tréner ho má vidieť pri prezeraní zverenca: kľúč sa pridá
-- do whitelistu politiky trainer_read (Backend/sql/trainer_read_access.sql).

drop policy if exists trainer_read on public.users_preferences;
create policy trainer_read on public.users_preferences
  for select to authenticated
  using (
    key in ('coach.prefs', 'advisor.session_templates', 'advisor.season_plan')
    and user_id in (select public.sr_my_athlete_ids())
  );

-- Rollback: rovnaká politika bez 'advisor.season_plan' (trainer_read_access.sql).
