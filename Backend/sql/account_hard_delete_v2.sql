-- account_hard_delete v2 – tvrdé zmazanie účtov so splatnou požiadavkou.
--
-- Oproti pôvodnej verzii:
--   * maže aj strength_sessions, exercise_suggestions, coach_advisor_reviews,
--     strava_webhook_events (owner_id = Strava athlete_id usera)
--   * maže tabuľky s FK na users bez CASCADE (activities_wrapped_summaries,
--     activities_wrapped_triggers, coach_plan_summaries) – PREČO: ich FK je
--     NO ACTION, takže `delete from users` pri userovi s wrapped / dokončeným
--     plánom padol a s ním celé volanie
--   * každý user v samostatnom bloku – chyba jedného nezhodí ostatných, vráti
--     sa v items ako `error`
--   * tabuľka, ktorá v prostredí neexistuje (dev), sa preskočí (to_regclass)
--   * reason v user_deletions: 'admin_force' (admin panel nastaví delete_at
--     pred requested_at), inak 'scheduled_cron'
--
-- Tabuľky s FK ON DELETE CASCADE (food_*, nutrition_*, intervals_accounts,
-- session_messages, trainer_links, account_delete_requests, food_products
-- created_by…) zmizne samé so zmazaním riadku v users.
-- Signatúra a tvar výsledku sú rovnaké – BE (Services/maintenance.py) netreba meniť.

create or replace function public.account_hard_delete(
  dry_run boolean default true,
  only_user_id bigint default null::bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now timestamptz := now();
  v_candidates int := 0;
  v_deleted int := 0;
  v_items jsonb := '[]'::jsonb;
  v_auth_uid uuid;
  v_mail text;
  v_tier text;
  v_had_strava boolean;
  v_athlete_id bigint;
  v_reason text;
  t text;
  r record;
  -- poradie: deti pred rodičmi, users až na konci
  v_tables text[] := array[
    -- aktivity
    'activities_streams', 'activities_laps', 'activities_splits',
    'activities_enrichment', 'activities_summary',
    'activities_wrapped_triggers', 'activities_wrapped_summaries',
    -- body scan
    'body_scans', 'inbody_scans',
    -- coach / AI
    'coach_external_events', 'coach_strength_history',
    'coach_plan_daily', 'coach_plan_weekly', 'coach_plan_summaries', 'coach_plan_meta',
    'coach_athlete_state', 'coach_user_notes', 'coach_advisor_reviews',
    'ai_usage_events',
    -- silový tréning
    'strength_sessions', 'exercise_suggestions',
    -- joby, predplatné, notifikácie
    'async_jobs', 'app_user_subscriptions', 'push_notifications',
    -- profil a metriky
    'profile_static',
    'users_bests', 'users_recovery', 'users_thresholds', 'users_zones',
    'users_preferences', 'users_health_log', 'users_metrics', 'users_pace_history'
  ];
begin
  for r in
    select
      adr.user_id::bigint as user_id,
      adr.delete_at,
      adr.requested_at
    from public.account_delete_requests adr
    where adr.delete_at is not null
      and adr.delete_at <= v_now
      and adr.cancelled_at is null
      and adr.hard_deleted_at is null
      and (only_user_id is null or adr.user_id::bigint = only_user_id)
    order by adr.delete_at asc
  loop
    v_candidates := v_candidates + 1;

    select u.auth_uid, u.mail_address
      into v_auth_uid, v_mail
    from public.users u
    where u.id::bigint = r.user_id;

    select tier_code
      into v_tier
    from public.app_user_subscriptions
    where user_id::bigint = r.user_id
      and status = 'active'
    limit 1;

    select sa.athlete_id::bigint
      into v_athlete_id
    from public.strava_accounts sa
    where sa.user_id::bigint = r.user_id
    limit 1;
    v_had_strava := v_athlete_id is not null;

    v_reason := case when r.delete_at < r.requested_at then 'admin_force' else 'scheduled_cron' end;

    if dry_run then
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'user_id', r.user_id, 'auth_uid', v_auth_uid, 'delete_at', r.delete_at,
        'reason', v_reason, 'dry_run', true
      ));
      continue;
    end if;

    begin
      -- audit záznam pred mazaním
      insert into public.user_deletions (
        user_id, auth_uid, mail_address, requested_at, deleted_at, reason, triggered_by,
        tier_code_at_deletion, had_strava
      ) values (
        r.user_id, v_auth_uid, v_mail, r.requested_at, v_now, v_reason, null,
        v_tier, v_had_strava
      );

      update public.account_delete_requests
        set hard_deleted_at = v_now
        where user_id::bigint = r.user_id;

      -- Strava: webhooky podľa athlete id (owner_id), potom účet
      if v_athlete_id is not null and to_regclass('public.strava_webhook_events') is not null then
        delete from public.strava_webhook_events where owner_id::bigint = v_athlete_id;
      end if;
      delete from public.strava_accounts where user_id::bigint = r.user_id;

      foreach t in array v_tables loop
        if to_regclass('public.' || t) is not null then
          execute format('delete from public.%I where user_id::bigint = $1', t) using r.user_id;
        end if;
      end loop;

      -- users (rodič) – CASCADE tabuľky zmizne s ním
      delete from public.users where id::bigint = r.user_id;

      v_deleted := v_deleted + 1;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'user_id', r.user_id, 'auth_uid', v_auth_uid, 'delete_at', r.delete_at,
        'reason', v_reason, 'dry_run', false
      ));
    exception when others then
      -- PREČO bez auth_uid: BE by inak zmazal auth usera, ktorého dáta ostali
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'user_id', r.user_id, 'error', sqlerrm, 'dry_run', false
      ));
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'dry_run', dry_run,
    'only_user_id', only_user_id,
    'candidates', v_candidates,
    'deleted_users', v_deleted,
    'items', v_items
  );
end;
$function$;
