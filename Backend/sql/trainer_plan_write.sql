-- Živý tréner (fáza 3): tréner upravuje plán zverenca.
-- Predpoklad: sql/trainer_links.sql a sql/trainer_read_access.sql
-- (funkcia sr_my_athlete_ids()).
--
-- Tréner smie len denný plán (coach_plan_daily): pridať, upraviť, zmazať,
-- presunúť, odložiť a spárovať tréning s aktivitou. Všetky tieto akcie idú
-- cez BE s JWT trénera (advisor-daily, coach-plan-daily reschedule/session,
-- coach-plan-active link), takže ich chráni práve táto RLS.
--
-- Zámerne BEZ zápisu: coach_plan_meta (začať/ukončiť plán), users_preferences
-- (ciele, preteky), recovery, health log, aktivity – to ostáva atlétovi.
--
-- WITH CHECK pri update: riadok sa nedá "presunúť" na iného usera.

drop policy if exists trainer_insert on public.coach_plan_daily;
create policy trainer_insert on public.coach_plan_daily
  for insert to authenticated
  with check (user_id in (select public.sr_my_athlete_ids()));

drop policy if exists trainer_update on public.coach_plan_daily;
create policy trainer_update on public.coach_plan_daily
  for update to authenticated
  using (user_id in (select public.sr_my_athlete_ids()))
  with check (user_id in (select public.sr_my_athlete_ids()));

drop policy if exists trainer_delete on public.coach_plan_daily;
create policy trainer_delete on public.coach_plan_daily
  for delete to authenticated
  using (user_id in (select public.sr_my_athlete_ids()));

-- Rollback:
-- drop policy if exists trainer_insert on public.coach_plan_daily;
-- drop policy if exists trainer_update on public.coach_plan_daily;
-- drop policy if exists trainer_delete on public.coach_plan_daily;
