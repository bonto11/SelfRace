-- Živý tréner (fáza 2): tréner číta dáta svojich aktívnych zverencov.
-- Predpoklad: sql/trainer_links.sql.
--
-- PREČO dodatočné politiky a nie úprava existujúcich: permissive politiky
-- sa medzi sebou OR-ujú, takže vlastník číta ďalej podľa svojej pôvodnej
-- politiky a tréner dostane navyše len SELECT. Zápis (insert/update/delete)
-- tréner nemá nikde – plán za atléta zatiaľ nemení.
--
-- Prístup je viazaný na ŽIVÝ stav linku: po ukončení spolupráce
-- (status != 'active') tréner okamžite nevidí nič.
--
-- Mimo whitelistu zámerne: body_scans (fotky), users_notes, activities_raw
-- (surové Strava dáta), strava_accounts, intervals_accounts, async_jobs,
-- ai_*, app_*, push_notifications, account_delete_requests, trainer_links.

-- Id zverencov, ktorých práve trénuje prihlásený user.
-- security definer: users a trainer_links sú pod vlastným RLS (trainer_links
-- úplne zavretá), funkcia ich musí čítať bez neho. Vracia len id, nič iné.
-- auth_uid sa porovnáva ako text (rovnako ako sql/retention.sql).
create or replace function public.sr_my_athlete_ids()
returns setof bigint
language sql
stable
security definer
set search_path = public
as $$
  select tl.athlete_user_id
  from public.trainer_links tl
  join public.users u on u.id = tl.trainer_user_id
  where tl.status = 'active'
    and u.auth_uid::text = (select auth.uid())::text
$$;

revoke all on function public.sr_my_athlete_ids() from public, anon;
grant execute on function public.sr_my_athlete_ids() to authenticated;

-- `(select ...)` = Postgres funkciu vyhodnotí raz na dotaz (initPlan),
-- nie pre každý riadok.
do $$
declare
  t text;
begin
  foreach t in array array[
    'activities_summary',
    'activities_enrichment',
    'activities_streams',
    'activities_splits',
    'activities_laps',
    'strength_sessions',
    'exercise_suggestions',
    'users_zones',
    'users_thresholds',
    'users_bests',
    'users_recovery',
    'users_pace_history',
    'users_metrics',
    'users_health_log',
    'profile_static',
    'coach_athlete_state',
    'coach_plan_daily',
    'coach_plan_weekly',
    'coach_plan_meta',
    'coach_strength_history',
    'coach_external_events',
    'coach_advisor_reviews',
    'coach_user_notes'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists trainer_read on public.%I', t);
      execute format(
        'create policy trainer_read on public.%I for select to authenticated '
        'using (user_id in (select public.sr_my_athlete_ids()))',
        t
      );
    else
      raise notice 'trainer_read: tabuľka % neexistuje, preskakujem', t;
    end if;
  end loop;
end $$;

-- users_preferences: len kľúče, ktoré tréner potrebuje (ciele, preteky,
-- objem, šablóny). user.settings, engagement.*, onboarding.* ostávajú súkromné.
drop policy if exists trainer_read on public.users_preferences;
create policy trainer_read on public.users_preferences
  for select to authenticated
  using (
    key in ('coach.prefs', 'advisor.session_templates')
    and user_id in (select public.sr_my_athlete_ids())
  );

-- Rollback:
-- do $$ declare t text; begin
--   for t in select tablename from pg_policies
--            where schemaname = 'public' and policyname = 'trainer_read'
--   loop execute format('drop policy trainer_read on public.%I', t); end loop;
-- end $$;
-- drop function if exists public.sr_my_athlete_ids();
