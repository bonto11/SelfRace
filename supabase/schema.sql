

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."coach_persona" AS ENUM (
    'drill_sergeant',
    'motivator',
    'analyst',
    'realist',
    'custom'
);


ALTER TYPE "public"."coach_persona" OWNER TO "postgres";


CREATE TYPE "public"."coach_plan_status" AS ENUM (
    'generated',
    'active',
    'archived'
);


ALTER TYPE "public"."coach_plan_status" OWNER TO "postgres";


CREATE TYPE "public"."forum_vote_value" AS ENUM (
    'AGREE',
    'PARTIAL',
    'MISLEADING'
);


ALTER TYPE "public"."forum_vote_value" OWNER TO "postgres";


CREATE TYPE "public"."intensity_kind" AS ENUM (
    'easy',
    'z2',
    'tempo',
    'threshold',
    'vo2',
    'sprint',
    'recovery',
    'gym'
);


ALTER TYPE "public"."intensity_kind" OWNER TO "postgres";


CREATE TYPE "public"."metric_key" AS ENUM (
    'weight_kg',
    'body_fat_pct',
    'HR_max',
    'VO2Max_measured',
    'VO2Max_estimated'
);


ALTER TYPE "public"."metric_key" OWNER TO "postgres";


CREATE TYPE "public"."sport_kind" AS ENUM (
    'run',
    'ride',
    'strength',
    'mixed',
    'other'
);


ALTER TYPE "public"."sport_kind" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_propagate_sport_type_fe_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.sport_type_fe IS DISTINCT FROM OLD.sport_type_fe THEN
    UPDATE public.activities_streams s
       SET sport_type_fe = LOWER(NEW.sport_type_fe)
     WHERE s.activity_id = NEW.activity_id
       AND s.user_id     = NEW.user_id;

    UPDATE public.activities_enrichment e
       SET sport_type_fe = LOWER(NEW.sport_type_fe)
     WHERE e.activity_id = NEW.activity_id
       AND e.user_id     = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_propagate_sport_type_fe_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_set_sport_type_fe_from_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_sport text;
BEGIN
  -- doplň iba keď je NULL alebo keď sa zmenilo activity_id
  IF (NEW.sport_type_fe IS NULL) OR (TG_OP = 'UPDATE' AND NEW.activity_id IS DISTINCT FROM OLD.activity_id) THEN
    SELECT s.sport_type_fe INTO v_sport
    FROM activities_summary s
    WHERE s.activity_id = NEW.activity_id;

    NEW.sport_type_fe := v_sport; -- môže zostať NULL, ak summary chýba (OK)
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_set_sport_type_fe_from_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."account_hard_delete"("dry_run" boolean DEFAULT true, "only_user_id" bigint DEFAULT NULL::bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_candidates int := 0;
  v_deleted int := 0;
  v_items jsonb := '[]'::jsonb;
  v_auth_uid uuid;
  r record;
begin
  for r in
    select
      adr.user_id::bigint as user_id,
      adr.delete_at
    from public.account_delete_requests adr
    where adr.delete_at is not null
      and adr.delete_at <= v_now
      and adr.cancelled_at is null
      and adr.hard_deleted_at is null
      and (only_user_id is null or adr.user_id::bigint = only_user_id)
    order by adr.delete_at asc
  loop
    v_candidates := v_candidates + 1;

    -- auth_uid si vytiahni ešte pred delete public.users
    select u.auth_uid
      into v_auth_uid
    from public.users u
    where u.id::bigint = r.user_id;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'user_id', r.user_id,
        'auth_uid', v_auth_uid,
        'delete_at', r.delete_at,
        'dry_run', dry_run
      )
    );

    if dry_run then
      continue;
    end if;

    -- audit
    update public.account_delete_requests
      set hard_deleted_at = v_now
      where user_id::bigint = r.user_id;

    -- STRAVA
    delete from public.strava_accounts where user_id::bigint = r.user_id;

    -- ACTIVITIES
    delete from public.activities_streams    where user_id::bigint = r.user_id;
    delete from public.activities_laps       where user_id::bigint = r.user_id;
    delete from public.activities_splits     where user_id::bigint = r.user_id;
    delete from public.activities_enrichment where user_id::bigint = r.user_id;
    delete from public.activities_summary    where user_id::bigint = r.user_id;

    -- COACH / AI
    delete from public.coach_feedback         where user_id::bigint = r.user_id;
    delete from public.coach_external_events  where user_id::bigint = r.user_id;
    delete from public.coach_strength_history where user_id::bigint = r.user_id;
    delete from public.coach_plan_daily       where user_id::bigint = r.user_id;
    delete from public.coach_plan_weekly      where user_id::bigint = r.user_id;
    delete from public.coach_plan_meta        where user_id::bigint = r.user_id;
    delete from public.coach_athlete_state    where user_id::bigint = r.user_id;

    delete from public.ai_usage_events        where user_id::bigint = r.user_id;
    delete from public.ai_wallet_transactions where user_id::bigint = r.user_id;

    -- JOBS
    delete from public.async_jobs where user_id::bigint = r.user_id;

    -- SUBSCRIPTIONS
    delete from public.app_user_subscriptions where user_id::bigint = r.user_id;

    -- PROFILE
    delete from public.profile_metric where user_id::bigint = r.user_id;
    delete from public.profile_static where user_id::bigint = r.user_id;

    -- USER META
    delete from public.users_bests       where user_id::bigint = r.user_id;
    delete from public.users_notes       where user_id::bigint = r.user_id;
    delete from public.users_recovery    where user_id::bigint = r.user_id;
    delete from public.users_thresholds  where user_id::bigint = r.user_id;
    delete from public.users_zones       where user_id::bigint = r.user_id;
    delete from public.users_preferences where user_id::bigint = r.user_id;

    -- USERS (parent)
    delete from public.users where id::bigint = r.user_id;

    v_deleted := v_deleted + 1;
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
$$;


ALTER FUNCTION "public"."account_hard_delete"("dry_run" boolean, "only_user_id" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" integer NOT NULL,
    "name" "text",
    "age" integer,
    "mail_address" "text",
    "strava_athlete_id" bigint,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auth_uid" "uuid",
    "user_uid" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "current_plan_code" "text",
    "ai_wallet_balance_micros" bigint DEFAULT 0,
    "app_subscription_tier" "text" DEFAULT 'free'::"text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."mail_address" IS 'Mail address of user';



CREATE OR REPLACE FUNCTION "public"."app_sync_user_profile"("p_auth_uid" "uuid", "p_email" "text", "p_display_name" "text") RETURNS "public"."users"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.users (auth_uid, user_uid, mail_address, display_name)
  values (p_auth_uid, p_auth_uid, p_email, p_display_name)
  on conflict (auth_uid) do update
    set mail_address = excluded.mail_address,
        display_name = coalesce(excluded.display_name, public.users.display_name)
  returning *;
$$;


ALTER FUNCTION "public"."app_sync_user_profile"("p_auth_uid" "uuid", "p_email" "text", "p_display_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_user_id"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select u.id
  from public.users u
  where u.auth_uid = auth.uid();
$$;


ALTER FUNCTION "public"."app_user_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."app_user_id"() IS 'Map auth.uid() (UUID) to application user_id (INT). Adjust the table/column if different.';



CREATE OR REPLACE FUNCTION "public"."auth_user_id"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.user_id
  from public.profiles p
  where p.auth_uid = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."auth_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_deleted_activities"("cutoff_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cutoff timestamptz := now() - make_interval(days => cutoff_days);

  v_summary_count      int := 0;
  v_streams_count      int := 0;
  v_laps_count         int := 0;
  v_splits_count       int := 0;
  v_enrichment_count   int := 0;
begin
  -- dočasná tabuľka s aktivitami na zmazanie (user_id + activity_id)
  create temporary table _to_delete on commit drop as
  select user_id, activity_id
  from activities_summary
  where deleted_at is not null
    and deleted_at < v_cutoff;

  if not exists (select 1 from _to_delete) then
    return jsonb_build_object(
      'summary', 0,
      'streams', 0,
      'laps', 0,
      'splits', 0,
      'enrichment', 0
    );
  end if;

  -- streams
  delete from activities_streams s
  using _to_delete t
  where s.user_id = t.user_id
    and s.activity_id = t.activity_id;
  get diagnostics v_streams_count = row_count;

  -- laps
  delete from activities_laps l
  using _to_delete t
  where l.user_id = t.user_id
    and l.activity_id = t.activity_id;
  get diagnostics v_laps_count = row_count;

  -- splits
  delete from activities_splits sp
  using _to_delete t
  where sp.user_id = t.user_id
    and sp.activity_id = t.activity_id;
  get diagnostics v_splits_count = row_count;

  -- enrichment (ak máš takú tabuľku – ak nie, tento blok vyhoď)
  begin
    delete from activities_enrichment e
    using _to_delete t
    where e.user_id = t.user_id
      and e.activity_id = t.activity_id;
    get diagnostics v_enrichment_count = row_count;
  exception when undefined_table then
    v_enrichment_count := 0;
  end;

  -- nakoniec summary
  delete from activities_summary a
  using _to_delete t
  where a.user_id = t.user_id
    and a.activity_id = t.activity_id;
  get diagnostics v_summary_count = row_count;

  return jsonb_build_object(
    'summary',    v_summary_count,
    'streams',    v_streams_count,
    'laps',       v_laps_count,
    'splits',     v_splits_count,
    'enrichment', v_enrichment_count
  );
end;
$$;


ALTER FUNCTION "public"."cleanup_deleted_activities"("cutoff_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_activity_details"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  n_streams int := 0;
  n_laps int := 0;
  n_splits int := 0;
begin
  -- streams
  delete from public.activities_streams
  where expires_at <= now()
     or deleted_at is not null;
  get diagnostics n_streams = row_count;

  -- laps
  delete from public.activities_laps
  where expires_at <= now()
     or deleted_at is not null;
  get diagnostics n_laps = row_count;

  -- splits
  delete from public.activities_splits
  where expires_at <= now()
     or deleted_at is not null;
  get diagnostics n_splits = row_count;

  return json_build_object(
    'ok', true,
    'deleted', json_build_object(
      'streams', n_streams,
      'laps', n_laps,
      'splits', n_splits
    )
  );
end;
$$;


ALTER FUNCTION "public"."cleanup_expired_activity_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_user_zones_default"("p_user_id" integer, "p_sport" "text" DEFAULT 'running'::"text", "p_hrmax" integer DEFAULT NULL::integer, "p_method" "text" DEFAULT 'default'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_hrmax int := coalesce(p_hrmax, 190);
  z1 int; z2 int; z3 int; z4 int; z5 int;
begin
  -- ak už existuje riadok, skonči
  if exists (select 1 from public.user_zones where user_id = p_user_id and sport = p_sport) then
    return;
  end if;

  -- prahy (percentá z HRmax, okrúhlené)
  z1 := round(v_hrmax * 0.60);
  z2 := round(v_hrmax * 0.70);
  z3 := round(v_hrmax * 0.80);
  z4 := round(v_hrmax * 0.90);
  z5 := v_hrmax;

  insert into public.user_zones(
    user_id, sport, hr_max, method,
    z1_min, z1_max,
    z2_min, z2_max,
    z3_min, z3_max,
    z4_min, z4_max,
    z5_min, z5_max
  )
  values (
    p_user_id, p_sport, v_hrmax, p_method,
    0,  z1,
    z1+1, z2,
    z2+1, z3,
    z3+1, z4,
    z4+1, z5
  );
end $$;


ALTER FUNCTION "public"."ensure_user_zones_default"("p_user_id" integer, "p_sport" "text", "p_hrmax" integer, "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  -- Vytvor dočasný riadok v users (ak chceš).
  insert into public.users (name, created_at)
  values ('New User', now());

  -- Napáruj na profiles.user_id = novovzniknuté users.id
  insert into public.profiles (auth_uid, user_id)
  values (new.id, (select id from public.users order by id desc limit 1));

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.users (
    auth_uid,
    mail_address,
    created_at
  )
  values (
    new.id,        -- auth user id (uuid)
    new.email,     -- mail_address = supabase email
    now()
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sport_type_from_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_sport text;
BEGIN
  -- ak nie je activity_id, nerob nič
  IF NEW.activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- vezmi sport zo summary podľa user_id + activity_id
  SELECT LOWER(s.sport_type_fe)
    INTO v_sport
  FROM public.activities_summary s
  WHERE s.activity_id = NEW.activity_id
    AND s.user_id     = NEW.user_id
  LIMIT 1;

  NEW.sport_type_fe := COALESCE(v_sport, COALESCE(NEW.sport_type_fe, 'other'));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_sport_type_from_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_enrichment_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_z1" integer, "p_z2" integer, "p_z3" integer, "p_z4" integer, "p_z5" integer, "p_computed_at" timestamp with time zone DEFAULT "now"()) RETURNS "void"
    LANGUAGE "sql"
    AS $$
insert into activities_enrichment (
  activity_id, user_id, user_uid, sport_type_fe,
  z1_min, z2_min, z3_min, z4_min, z5_min,
  computed_at
)
select
  p_activity_id,
  p_user_id,
  u.auth_uid,
  coalesce(s.sport_type_fe, 'other'),
  p_z1, p_z2, p_z3, p_z4, p_z5,
  p_computed_at
from activities_summary s
join users u on u.id = p_user_id
where s.activity_id = p_activity_id and s.user_id = p_user_id
on conflict (activity_id) do update set
  user_id       = excluded.user_id,
  user_uid      = excluded.user_uid,
  sport_type_fe = excluded.sport_type_fe,
  z1_min        = excluded.z1_min,
  z2_min        = excluded.z2_min,
  z3_min        = excluded.z3_min,
  z4_min        = excluded.z4_min,
  z5_min        = excluded.z5_min,
  computed_at   = now();
$$;


ALTER FUNCTION "public"."upsert_enrichment_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_z1" integer, "p_z2" integer, "p_z3" integer, "p_z4" integer, "p_z5" integer, "p_computed_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[]) RETURNS "void"
    LANGUAGE "sql"
    AS $$
insert into activities_streams (
  activity_id, user_id, user_uid, sport_type_fe,
  time_s, heartrate_bpm, cadence_rpm, power_w, distance_m
)
select
  p_activity_id,
  p_user_id,
  u.auth_uid,
  coalesce(s.sport_type_fe, 'other'),
  p_time_s,
  nullif(p_heartrate, '{}'),
  nullif(p_cadence,  '{}'),
  nullif(p_power,    '{}'),
  nullif(p_distance, '{}')
from activities_summary s
join users u on u.id = p_user_id
where s.activity_id = p_activity_id and s.user_id = p_user_id
on conflict (activity_id) do update set
  user_id       = excluded.user_id,
  user_uid      = excluded.user_uid,
  sport_type_fe = excluded.sport_type_fe,
  time_s        = excluded.time_s,
  heartrate_bpm = excluded.heartrate_bpm,
  cadence_rpm   = excluded.cadence_rpm,
  power_w       = excluded.power_w,
  distance_m    = excluded.distance_m,
  updated_at    = now();
$$;


ALTER FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[], "p_altitude" double precision[] DEFAULT '{}'::double precision[], "p_speed" double precision[] DEFAULT '{}'::double precision[], "p_grade" double precision[] DEFAULT '{}'::double precision[], "p_temp" double precision[] DEFAULT '{}'::double precision[], "user_jwt" "text" DEFAULT NULL::"text", "service" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  insert into public.activities_streams (
    activity_id,
    user_id,
    user_uid,
    sport_type_fe,
    time_s,
    heartrate_bpm,
    cadence_rpm,
    power_w,
    distance_m,
    altitude_m,
    speed_mps,
    grade_smooth,
    temp_c
  )
  select
    p_activity_id,
    p_user_id,
    u.auth_uid,
    coalesce(s.sport_type_fe, 'other'),
    p_time_s,
    nullif(p_heartrate, '{}'),
    nullif(p_cadence, '{}'),
    nullif(p_power, '{}'),
    nullif(p_distance, '{}'),
    nullif(p_altitude, '{}'),
    nullif(p_speed, '{}'),
    nullif(p_grade, '{}'),
    nullif(p_temp, '{}')
  from activities_summary s
  join users u on u.id = p_user_id
  where s.activity_id = p_activity_id
    and s.user_id = p_user_id
  on conflict (activity_id) do update
  set
    user_id        = excluded.user_id,
    user_uid       = excluded.user_uid,
    sport_type_fe  = excluded.sport_type_fe,
    time_s         = excluded.time_s,
    heartrate_bpm  = excluded.heartrate_bpm,
    cadence_rpm    = excluded.cadence_rpm,
    power_w        = excluded.power_w,
    distance_m     = excluded.distance_m,
    altitude_m     = excluded.altitude_m,
    speed_mps      = excluded.speed_mps,
    grade_smooth   = excluded.grade_smooth,
    temp_c         = excluded.temp_c,
    updated_at     = now();
$$;


ALTER FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[], "p_altitude" double precision[], "p_speed" double precision[], "p_grade" double precision[], "p_temp" double precision[], "user_jwt" "text", "service" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_delete_requests" (
    "user_id" integer NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delete_at" timestamp with time zone NOT NULL,
    "cancelled_at" timestamp with time zone,
    "hard_deleted_at" timestamp with time zone
);


ALTER TABLE "public"."account_delete_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities_enrichment" (
    "activity_id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "user_uid" "uuid" NOT NULL,
    "z1_min" integer DEFAULT 0 NOT NULL,
    "z2_min" integer DEFAULT 0 NOT NULL,
    "z3_min" integer DEFAULT 0 NOT NULL,
    "z4_min" integer DEFAULT 0 NOT NULL,
    "z5_min" integer DEFAULT 0 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sport_type_fe" "text" DEFAULT 'other'::"text",
    "avg_hr_bpm" numeric,
    "moving_time_s" integer,
    "distance_m" numeric,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "activities_enrichment_sport_type_fe_check" CHECK (("sport_type_fe" = ANY (ARRAY['run'::"text", 'ride'::"text", 'strength'::"text", 'soccer'::"text", 'skate'::"text", 'walk'::"text", 'hike'::"text", 'swim'::"text", 'mixed'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."activities_enrichment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities_laps" (
    "activity_id" bigint NOT NULL,
    "lap_index" integer NOT NULL,
    "start_date_local" timestamp with time zone,
    "distance_m" integer,
    "moving_time_s" integer,
    "elapsed_time_s" integer,
    "total_elev_gain_m" numeric(7,1),
    "avg_speed_mps" numeric(6,3),
    "max_speed_mps" numeric(6,3),
    "avg_cadence_rpm" numeric(5,1),
    "avg_watts" numeric(7,1),
    "avg_hr_bpm" smallint,
    "max_hr_bpm" smallint,
    "pace_s_per_km" integer,
    "user_uid" "uuid",
    "user_id" integer,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL
);


ALTER TABLE "public"."activities_laps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities_splits" (
    "activity_id" bigint NOT NULL,
    "split_index" integer NOT NULL,
    "distance_m" integer NOT NULL,
    "moving_time_s" integer NOT NULL,
    "elapsed_time_s" integer NOT NULL,
    "elevation_diff_m" numeric(6,1),
    "avg_speed_mps" numeric(6,3),
    "avg_gap_mps" numeric(6,3),
    "avg_hr_bpm" smallint,
    "pace_s_per_km" integer,
    "user_uid" "uuid",
    "user_id" integer,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL
);


ALTER TABLE "public"."activities_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities_streams" (
    "activity_id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "user_uid" "uuid" NOT NULL,
    "sport_type_fe" "text" DEFAULT 'other'::"text",
    "time_s" integer[] NOT NULL,
    "heartrate_bpm" smallint[],
    "cadence_rpm" smallint[],
    "power_w" smallint[],
    "distance_m" double precision[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "altitude_m" double precision[],
    "speed_mps" double precision[],
    "grade_smooth" double precision[],
    "temp_c" double precision[],
    "moving" boolean[],
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    CONSTRAINT "activities_streams_sport_type_fe_check" CHECK (("sport_type_fe" = ANY (ARRAY['run'::"text", 'ride'::"text", 'strength'::"text", 'soccer'::"text", 'skate'::"text", 'walk'::"text", 'hike'::"text", 'swim'::"text", 'mixed'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."activities_streams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities_summary" (
    "activity_id" bigint NOT NULL,
    "name" "text",
    "date" timestamp with time zone,
    "elevation_gain_m" numeric,
    "timezone" "text",
    "utc_offset_s" integer,
    "distance_m" integer,
    "moving_time_s" integer,
    "elapsed_time_s" integer,
    "average_speed_mps" numeric(6,3),
    "max_speed_mps" numeric(6,3),
    "average_heartrate_bpm" numeric(5,2),
    "max_heartrate_bpm" numeric(5,2),
    "elev_high_m" numeric(7,1),
    "elev_low_m" numeric(7,1),
    "achievement_count" integer,
    "pr_count" integer,
    "calories_kcal" integer,
    "sport_type" "text",
    "description" "text",
    "comment" "text",
    "gear_id" "text",
    "gear_name" "text",
    "pace_seconds_per_km" integer,
    "user_uid" "uuid",
    "user_id" integer,
    "average_cadence_rpm" real,
    "average_temp_c" real,
    "average_watts" real,
    "max_watts" real,
    "sport_type_ovrd" "text",
    "sport_type_fe" "text",
    "deleted_at" timestamp with time zone,
    "workout_type" smallint,
    "map_summary_polyline" "text",
    "map_polyline" "text",
    CONSTRAINT "activities_summary_sport_type_fe_check" CHECK (("sport_type_fe" = ANY (ARRAY['run'::"text", 'ride'::"text", 'strength'::"text", 'soccer'::"text", 'skate'::"text", 'walk'::"text", 'hike'::"text", 'swim'::"text", 'mixed'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."activities_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_provider_pricing" (
    "id" bigint NOT NULL,
    "model" "text" NOT NULL,
    "price_input_micros_per_1k" bigint NOT NULL,
    "price_output_micros_per_1k" bigint NOT NULL,
    "price_reasoning_micros_per_1k" bigint NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_provider_pricing" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_provider_pricing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_provider_pricing_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_provider_pricing_id_seq" OWNED BY "public"."ai_provider_pricing"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_usage_events" (
    "id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "model" "text" NOT NULL,
    "job_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "reasoning_tokens" integer DEFAULT 0 NOT NULL,
    "total_tokens" integer DEFAULT 0 NOT NULL,
    "unit_price_micros" bigint DEFAULT 0 NOT NULL,
    "cost_micros" bigint DEFAULT 0 NOT NULL,
    "billed_via" "text" DEFAULT 'internal'::"text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_usage_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_usage_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_usage_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_usage_events_id_seq" OWNED BY "public"."ai_usage_events"."id";



CREATE TABLE IF NOT EXISTS "public"."ai_wallet_transactions" (
    "id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "kind" "text" NOT NULL,
    "amount_micros" bigint NOT NULL,
    "source" "text" NOT NULL,
    "related_usage_event_id" bigint,
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_wallet_transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ai_wallet_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ai_wallet_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."ai_wallet_transactions_id_seq" OWNED BY "public"."ai_wallet_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."app_subscription_tiers" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "monthly_price_cents" integer DEFAULT 0 NOT NULL,
    "ai_monthly_tokens_limit" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_subscription_tiers" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."app_subscription_tiers_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."app_subscription_tiers_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."app_subscription_tiers_id_seq" OWNED BY "public"."app_subscription_tiers"."id";



CREATE TABLE IF NOT EXISTS "public"."app_user_subscriptions" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "tier_code" "text" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "external_customer_id" "text",
    "external_subscription_id" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_user_subscriptions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."app_user_subscriptions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."app_user_subscriptions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."app_user_subscriptions_id_seq" OWNED BY "public"."app_user_subscriptions"."id";



CREATE TABLE IF NOT EXISTS "public"."async_jobs" (
    "user_id" bigint NOT NULL,
    "user_uid" "uuid" NOT NULL,
    "job_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "input" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "result" "jsonb",
    "error" "text",
    "progress" integer DEFAULT 0 NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "run_after" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "id" bigint NOT NULL
);


ALTER TABLE "public"."async_jobs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."async_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."async_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."async_jobs_id_seq" OWNED BY "public"."async_jobs"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_athlete_state" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "model" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "state_json" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "compare_previous" "jsonb"
);


ALTER TABLE "public"."coach_athlete_state" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_athlete_state_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_athlete_state_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_athlete_state_id_seq" OWNED BY "public"."coach_athlete_state"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_external_events" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "sport" "text",
    "weekday" "text" NOT NULL,
    "duration_min" integer,
    "priority" "text" DEFAULT 'fixed'::"text" NOT NULL,
    "notes" "text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recurrence_kind" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "single_date" "date",
    "start_time_local" "text",
    "intensity" "text"
);


ALTER TABLE "public"."coach_external_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_external_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_external_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_external_events_id_seq" OWNED BY "public"."coach_external_events"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_feedback" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "text" "text" NOT NULL,
    "weeks" integer,
    "goal" "text",
    "model" "text",
    "context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_uid" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."coach_feedback" OWNER TO "postgres";


ALTER TABLE "public"."coach_feedback" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."coach_feedback_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."coach_plan_daily" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "plan_date" "date" NOT NULL,
    "sport" "text" NOT NULL,
    "title" "text",
    "duration_min" integer,
    "intensity" "text",
    "structure" "jsonb",
    "notes" "text",
    "source" "text",
    "session_type" "text",
    "session_index" integer DEFAULT 0 NOT NULL,
    "payload" "jsonb",
    "activity_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_plan_daily" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_plan_daily_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_plan_daily_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_plan_daily_id_seq" OWNED BY "public"."coach_plan_daily"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_plan_meta" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "status" "public"."coach_plan_status" DEFAULT 'generated'::"public"."coach_plan_status" NOT NULL,
    "kind" "text",
    "base_state_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "meta_json" "jsonb",
    "start_date" "date",
    "end_date" "date",
    "weeks_total" integer,
    "main_sport" "text",
    "goal_kind" "text",
    "source" "text"
);


ALTER TABLE "public"."coach_plan_meta" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_plan_meta_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_plan_meta_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_plan_meta_id_seq" OWNED BY "public"."coach_plan_meta"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_plan_weekly" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "week_index" integer NOT NULL,
    "week_start" "date" NOT NULL,
    "week_end" "date" NOT NULL,
    "goal" "text",
    "focus" "text",
    "load_phase" "text",
    "planned_km" numeric,
    "planned_minutes" integer,
    "completed_km" numeric,
    "completed_minutes" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_json" "jsonb"
);


ALTER TABLE "public"."coach_plan_weekly" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_plan_weekly_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_plan_weekly_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_plan_weekly_id_seq" OWNED BY "public"."coach_plan_weekly"."id";



CREATE TABLE IF NOT EXISTS "public"."coach_strength_history" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "session_date" "date" NOT NULL,
    "session_index" integer DEFAULT 0 NOT NULL,
    "slot" "text" NOT NULL,
    "exercise_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_strength_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."coach_strength_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."coach_strength_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."coach_strength_history_id_seq" OWNED BY "public"."coach_strength_history"."id";



CREATE TABLE IF NOT EXISTS "public"."profile_metric" (
    "id" bigint NOT NULL,
    "user_id" integer,
    "user_uid" "uuid",
    "metric" "public"."metric_key" NOT NULL,
    "value_num" numeric(12,4) NOT NULL,
    "unit" "text",
    "measured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_metric_user_present" CHECK ((("user_id" IS NOT NULL) OR ("user_uid" IS NOT NULL)))
);


ALTER TABLE "public"."profile_metric" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."profile_metric_value_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."profile_metric_value_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."profile_metric_value_id_seq" OWNED BY "public"."profile_metric"."id";



CREATE TABLE IF NOT EXISTS "public"."profile_static" (
    "id" bigint NOT NULL,
    "user_id" integer,
    "user_uid" "uuid",
    "sex" "text",
    "birth_date" "date",
    "height_cm" numeric(6,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_static_sex_check" CHECK (("sex" = ANY (ARRAY['M'::"text", 'F'::"text"]))),
    CONSTRAINT "profile_static_user_present" CHECK ((("user_id" IS NOT NULL) OR ("user_uid" IS NOT NULL)))
);


ALTER TABLE "public"."profile_static" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."profile_static_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."profile_static_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."profile_static_id_seq" OWNED BY "public"."profile_static"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."runners_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."runners_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."runners_id_seq" OWNED BY "public"."users"."id";



CREATE TABLE IF NOT EXISTS "public"."strava_accounts" (
    "id" bigint NOT NULL,
    "user_id" bigint NOT NULL,
    "athlete_id" bigint NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "scope" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deauthorized_at" timestamp with time zone,
    "ever_synced_at" timestamp with time zone
);


ALTER TABLE "public"."strava_accounts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."strava_accounts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."strava_accounts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."strava_accounts_id_seq" OWNED BY "public"."strava_accounts"."id";



CREATE TABLE IF NOT EXISTS "public"."strava_webhook_events" (
    "id" bigint NOT NULL,
    "subscription_id" bigint,
    "object_type" "text" NOT NULL,
    "object_id" bigint NOT NULL,
    "aspect_type" "text" NOT NULL,
    "owner_id" bigint NOT NULL,
    "event_time" timestamp with time zone NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."strava_webhook_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."strava_webhook_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."strava_webhook_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."strava_webhook_events_id_seq" OWNED BY "public"."strava_webhook_events"."id";



CREATE TABLE IF NOT EXISTS "public"."users_bests" (
    "distance_m" integer NOT NULL,
    "best_time_s" integer,
    "activity_id" bigint,
    "achieved_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_uid" "uuid",
    "user_id" integer NOT NULL,
    "sport" "text" DEFAULT 'run'::"text" NOT NULL,
    "activity_name" "text",
    CONSTRAINT "users_bests_distance_m_check" CHECK (("distance_m" = ANY (ARRAY[400, 1000, 5000, 10000, 20000, 21097, 30000, 42195, 50000])))
);


ALTER TABLE "public"."users_bests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_notes" (
    "id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "activity_id" bigint NOT NULL,
    "feeling" "text",
    "energy" integer,
    "mood" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_uid" "uuid" DEFAULT "auth"."uid"()
);


ALTER TABLE "public"."users_notes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_notes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_notes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_notes_id_seq" OWNED BY "public"."users_notes"."id";



CREATE TABLE IF NOT EXISTS "public"."users_preferences" (
    "user_id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_recovery" (
    "date" "date" NOT NULL,
    "RHR_bpm" numeric,
    "HRV_avg_ms" numeric,
    "HRV_max_ms" numeric,
    "sleep_duration_min" numeric,
    "food_2h_before" boolean DEFAULT false,
    "comments" "text",
    "alcohol_type_pct" numeric,
    "alcohol_volume_ml" numeric DEFAULT '0'::numeric,
    "caffeine_8h" boolean DEFAULT false,
    "user_uid" "uuid",
    "user_id" integer,
    "id" integer NOT NULL,
    "sleep_start_time" "text"
);


ALTER TABLE "public"."users_recovery" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_recovery_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_recovery_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_recovery_id_seq" OWNED BY "public"."users_recovery"."id";



CREATE TABLE IF NOT EXISTS "public"."users_thresholds" (
    "sport" "text" NOT NULL,
    "threshold_type" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "hr_bpm" numeric,
    "pace_sec_km" numeric,
    "power_watt" numeric,
    "measurement_type" "text",
    "user_uid" "uuid",
    "user_id" integer NOT NULL,
    "id" bigint NOT NULL
);


ALTER TABLE "public"."users_thresholds" OWNER TO "postgres";


ALTER TABLE "public"."users_thresholds" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."users_thresholds_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users_zones" (
    "id" bigint NOT NULL,
    "user_id" integer NOT NULL,
    "sport" "text" NOT NULL,
    "hr_max_bpm" integer,
    "z1_max_bpm" integer NOT NULL,
    "z2_min_bpm" integer NOT NULL,
    "z2_max_bpm" integer NOT NULL,
    "z3_min_bpm" integer NOT NULL,
    "z3_max_bpm" integer NOT NULL,
    "z4_min_bpm" integer NOT NULL,
    "z4_max_bpm" integer NOT NULL,
    "z5_min_bpm" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."users_zones" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."users_zones_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."users_zones_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."users_zones_id_seq" OWNED BY "public"."users_zones"."id";



ALTER TABLE ONLY "public"."ai_provider_pricing" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_provider_pricing_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_usage_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_usage_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."ai_wallet_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."ai_wallet_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_subscription_tiers" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."app_subscription_tiers_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."app_user_subscriptions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."app_user_subscriptions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."async_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."async_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_athlete_state" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_athlete_state_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_external_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_external_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_plan_daily" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_plan_daily_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_plan_meta" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_plan_meta_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_plan_weekly" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_plan_weekly_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."coach_strength_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."coach_strength_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."profile_metric" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."profile_metric_value_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."profile_static" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."profile_static_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."strava_accounts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."strava_accounts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."strava_webhook_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."strava_webhook_events_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."runners_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users_notes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_notes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users_recovery" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_recovery_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."users_zones" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."users_zones_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_delete_requests"
    ADD CONSTRAINT "account_delete_requests_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."activities_enrichment"
    ADD CONSTRAINT "activities_enrichment_pkey" PRIMARY KEY ("activity_id");



ALTER TABLE ONLY "public"."activities_laps"
    ADD CONSTRAINT "activities_laps_pkey" PRIMARY KEY ("activity_id", "lap_index");



ALTER TABLE ONLY "public"."activities_splits"
    ADD CONSTRAINT "activities_splits_pkey" PRIMARY KEY ("activity_id", "split_index");



ALTER TABLE ONLY "public"."activities_streams"
    ADD CONSTRAINT "activities_streams_pkey" PRIMARY KEY ("activity_id");



ALTER TABLE ONLY "public"."activities_summary"
    ADD CONSTRAINT "activity_summary_pkey" PRIMARY KEY ("activity_id");



ALTER TABLE ONLY "public"."ai_provider_pricing"
    ADD CONSTRAINT "ai_provider_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_wallet_transactions"
    ADD CONSTRAINT "ai_wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_subscription_tiers"
    ADD CONSTRAINT "app_subscription_tiers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."app_subscription_tiers"
    ADD CONSTRAINT "app_subscription_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_user_subscriptions"
    ADD CONSTRAINT "app_user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."async_jobs"
    ADD CONSTRAINT "async_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_athlete_state"
    ADD CONSTRAINT "coach_athlete_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_external_events"
    ADD CONSTRAINT "coach_external_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_feedback"
    ADD CONSTRAINT "coach_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_plan_daily"
    ADD CONSTRAINT "coach_plan_daily_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_plan_meta"
    ADD CONSTRAINT "coach_plan_meta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_plan_weekly"
    ADD CONSTRAINT "coach_plan_weekly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_strength_history"
    ADD CONSTRAINT "coach_strength_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_metric"
    ADD CONSTRAINT "profile_metric_value_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_static"
    ADD CONSTRAINT "profile_static_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "runners_mail_address_key" UNIQUE ("mail_address");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "runners_mail_unique" UNIQUE ("mail_address");



ALTER TABLE ONLY "public"."strava_accounts"
    ADD CONSTRAINT "strava_accounts_athlete_id_key" UNIQUE ("athlete_id");



ALTER TABLE ONLY "public"."strava_accounts"
    ADD CONSTRAINT "strava_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."strava_accounts"
    ADD CONSTRAINT "strava_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."strava_webhook_events"
    ADD CONSTRAINT "strava_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_recovery"
    ADD CONSTRAINT "uniq_user_date" UNIQUE ("user_id", "date");



ALTER TABLE ONLY "public"."users_notes"
    ADD CONSTRAINT "unique_user_activity" UNIQUE ("user_id", "activity_id");



ALTER TABLE ONLY "public"."profile_static"
    ADD CONSTRAINT "uq_profile_static_user_id" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."profile_static"
    ADD CONSTRAINT "uq_profile_static_user_uid" UNIQUE ("user_uid");



ALTER TABLE ONLY "public"."users_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id", "key");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_uid_key" UNIQUE ("auth_uid");



ALTER TABLE ONLY "public"."users_bests"
    ADD CONSTRAINT "users_bests_pk" PRIMARY KEY ("user_id", "sport", "distance_m");



ALTER TABLE ONLY "public"."users_notes"
    ADD CONSTRAINT "users_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_recovery"
    ADD CONSTRAINT "users_recovery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_thresholds"
    ADD CONSTRAINT "users_thresholds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users_thresholds"
    ADD CONSTRAINT "users_thresholds_user_sport_type_uk" UNIQUE ("user_id", "sport", "threshold_type");



ALTER TABLE ONLY "public"."users_zones"
    ADD CONSTRAINT "users_zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_laps_activity_id_idx" ON "public"."activities_laps" USING "btree" ("activity_id");



CREATE INDEX "activities_laps_expires_at_idx" ON "public"."activities_laps" USING "btree" ("expires_at");



CREATE UNIQUE INDEX "activities_laps_uidx" ON "public"."activities_laps" USING "btree" ("activity_id", "lap_index");



CREATE INDEX "activities_splits_activity_id_idx" ON "public"."activities_splits" USING "btree" ("activity_id");



CREATE INDEX "activities_splits_expires_at_idx" ON "public"."activities_splits" USING "btree" ("expires_at");



CREATE UNIQUE INDEX "activities_splits_uidx" ON "public"."activities_splits" USING "btree" ("activity_id", "split_index");



CREATE INDEX "activities_streams_expires_at_idx" ON "public"."activities_streams" USING "btree" ("expires_at");



CREATE INDEX "coach_feedback_user_created_idx" ON "public"."coach_feedback" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "coach_strength_history_user_date_idx" ON "public"."coach_strength_history" USING "btree" ("user_id", "session_date");



CREATE INDEX "coach_strength_history_user_exercise_idx" ON "public"."coach_strength_history" USING "btree" ("user_id", "exercise_id", "session_date");



CREATE INDEX "idx_act_summary_sport" ON "public"."activities_summary" USING "btree" ("sport_type");



CREATE INDEX "idx_activities_sport" ON "public"."activities_summary" USING "btree" ("lower"("sport_type"));



CREATE INDEX "idx_activities_summary_sport_type_fe" ON "public"."activities_summary" USING "btree" ("sport_type_fe");



CREATE INDEX "idx_activities_user_time" ON "public"."activities_summary" USING "btree" ("user_id", "date");



CREATE INDEX "idx_ai_provider_pricing_model_valid_from" ON "public"."ai_provider_pricing" USING "btree" ("model", "valid_from");



CREATE INDEX "idx_ai_usage_events_job_type" ON "public"."ai_usage_events" USING "btree" ("job_type");



CREATE INDEX "idx_ai_usage_events_user_created" ON "public"."ai_usage_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_ai_wallet_transactions_usage" ON "public"."ai_wallet_transactions" USING "btree" ("related_usage_event_id");



CREATE INDEX "idx_ai_wallet_transactions_user_created" ON "public"."ai_wallet_transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_app_subscription_tiers_active" ON "public"."app_subscription_tiers" USING "btree" ("is_active", "sort_order");



CREATE INDEX "idx_app_user_subscriptions_external" ON "public"."app_user_subscriptions" USING "btree" ("external_subscription_id");



CREATE INDEX "idx_app_user_subscriptions_user" ON "public"."app_user_subscriptions" USING "btree" ("user_id", "status", "current_period_end");



CREATE INDEX "idx_coach_athlete_state_user_created" ON "public"."coach_athlete_state" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_coach_athlete_state_user_version_created" ON "public"."coach_athlete_state" USING "btree" ("user_id", "version", "created_at" DESC);



CREATE INDEX "idx_coach_feedback_user_uid" ON "public"."coach_feedback" USING "btree" ("user_uid");



CREATE INDEX "idx_coach_plan_daily_activity" ON "public"."coach_plan_daily" USING "btree" ("activity_id");



CREATE INDEX "idx_coach_plan_daily_plan_date" ON "public"."coach_plan_daily" USING "btree" ("plan_id", "plan_date");



CREATE INDEX "idx_coach_plan_daily_user_date" ON "public"."coach_plan_daily" USING "btree" ("user_id", "plan_date", "session_index");



CREATE INDEX "idx_coach_plan_daily_user_plan" ON "public"."coach_plan_daily" USING "btree" ("user_id", "plan_id", "plan_date");



CREATE INDEX "idx_coach_plan_daily_user_plan_date" ON "public"."coach_plan_daily" USING "btree" ("user_id", "plan_id", "plan_date");



CREATE INDEX "idx_coach_plan_meta_user_status_created" ON "public"."coach_plan_meta" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "idx_coach_plan_weekly_user_created" ON "public"."coach_plan_weekly" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_coach_plan_weekly_user_dates" ON "public"."coach_plan_weekly" USING "btree" ("user_id", "week_start", "week_end");



CREATE INDEX "idx_coach_plan_weekly_user_plan" ON "public"."coach_plan_weekly" USING "btree" ("user_id", "plan_id");



CREATE INDEX "idx_coach_plan_weekly_user_plan_week" ON "public"."coach_plan_weekly" USING "btree" ("user_id", "plan_id", "week_index");



CREATE INDEX "idx_enrich_computed" ON "public"."activities_enrichment" USING "btree" ("computed_at" DESC);



CREATE INDEX "idx_enrich_user" ON "public"."activities_enrichment" USING "btree" ("user_id");



CREATE INDEX "idx_enrichment_activity_id" ON "public"."activities_enrichment" USING "btree" ("activity_id");



CREATE INDEX "idx_laps_activity" ON "public"."activities_laps" USING "btree" ("activity_id");



CREATE INDEX "idx_pm_user_id_metric_time" ON "public"."profile_metric" USING "btree" ("user_id", "metric", "measured_at") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_pm_user_uid_metric_time" ON "public"."profile_metric" USING "btree" ("user_uid", "metric", "measured_at") WHERE ("user_uid" IS NOT NULL);



CREATE INDEX "idx_pm_user_uid_metric_time_desc" ON "public"."profile_metric" USING "btree" ("user_uid", "metric", "measured_at" DESC) WHERE ("user_uid" IS NOT NULL);



CREATE INDEX "idx_splits_activity" ON "public"."activities_splits" USING "btree" ("activity_id");



CREATE INDEX "idx_streams_activity_id" ON "public"."activities_streams" USING "btree" ("activity_id");



CREATE INDEX "idx_streams_updated" ON "public"."activities_streams" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_streams_user_created" ON "public"."activities_streams" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_bests_activity" ON "public"."users_bests" USING "btree" ("activity_id");



CREATE INDEX "idx_user_preferences_key" ON "public"."users_preferences" USING "btree" ("key");



CREATE INDEX "idx_user_preferences_user" ON "public"."users_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_users_app_subscription_tier" ON "public"."users" USING "btree" ("app_subscription_tier");



CREATE INDEX "idx_users_bests_activity" ON "public"."users_bests" USING "btree" ("activity_id");



CREATE INDEX "idx_users_bests_user" ON "public"."users_bests" USING "btree" ("user_id");



CREATE INDEX "idx_users_bests_user_id_distance" ON "public"."users_bests" USING "btree" ("user_id", "distance_m");



CREATE INDEX "idx_users_notes_user_uid" ON "public"."users_notes" USING "btree" ("user_uid");



CREATE INDEX "idx_users_strava_athlete" ON "public"."users" USING "btree" ("strava_athlete_id");



CREATE INDEX "idx_users_zones_user_sport_created" ON "public"."users_zones" USING "btree" ("user_id", "sport", "created_at" DESC);



CREATE INDEX "jobs_kind_idx" ON "public"."async_jobs" USING "btree" ("job_type");



CREATE INDEX "jobs_locked_idx" ON "public"."async_jobs" USING "btree" ("locked_at", "status");



CREATE INDEX "jobs_status_runafter_idx" ON "public"."async_jobs" USING "btree" ("status", "run_after" NULLS FIRST, "created_at");



CREATE INDEX "jobs_user_created_idx" ON "public"."async_jobs" USING "btree" ("user_uid", "created_at" DESC);



CREATE UNIQUE INDEX "strava_accounts_athlete_idx" ON "public"."strava_accounts" USING "btree" ("athlete_id");



CREATE INDEX "strava_accounts_ever_synced_at_idx" ON "public"."strava_accounts" USING "btree" ("ever_synced_at");



CREATE UNIQUE INDEX "strava_accounts_user_idx" ON "public"."strava_accounts" USING "btree" ("user_id");



CREATE INDEX "strava_webhook_events_owner_idx" ON "public"."strava_webhook_events" USING "btree" ("owner_id");



CREATE INDEX "strava_webhook_events_status_idx" ON "public"."strava_webhook_events" USING "btree" ("status", "created_at");



CREATE UNIQUE INDEX "uq_coach_plan_meta_user_active" ON "public"."coach_plan_meta" USING "btree" ("user_id") WHERE ("status" = 'active'::"public"."coach_plan_status");



CREATE UNIQUE INDEX "uq_coach_plan_meta_user_plan" ON "public"."coach_plan_meta" USING "btree" ("user_id", "plan_id");



CREATE UNIQUE INDEX "users_auth_uid_uk" ON "public"."users" USING "btree" ("auth_uid");



CREATE UNIQUE INDEX "users_mail_address_uk" ON "public"."users" USING "btree" ("lower"("mail_address"));



CREATE UNIQUE INDEX "users_thresholds_user_sport_type_key" ON "public"."users_thresholds" USING "btree" ("user_id", "sport", "threshold_type");



CREATE OR REPLACE TRIGGER "trg_jobs_updated_at" BEFORE UPDATE ON "public"."async_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profile_static_updated" BEFORE UPDATE ON "public"."profile_static" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_sport_type_enrich" BEFORE INSERT OR UPDATE OF "activity_id", "sport_type_fe" ON "public"."activities_enrichment" FOR EACH ROW EXECUTE FUNCTION "public"."set_sport_type_from_summary"();



CREATE OR REPLACE TRIGGER "trg_set_sport_type_streams" BEFORE INSERT OR UPDATE OF "activity_id", "sport_type_fe" ON "public"."activities_streams" FOR EACH ROW EXECUTE FUNCTION "public"."set_sport_type_from_summary"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "public"."users_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_strava_accounts_updated_at" BEFORE UPDATE ON "public"."strava_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_summary_propagate_sport" AFTER UPDATE OF "sport_type_fe" ON "public"."activities_summary" FOR EACH ROW EXECUTE FUNCTION "public"."_propagate_sport_type_fe_change"();



ALTER TABLE ONLY "public"."account_delete_requests"
    ADD CONSTRAINT "account_delete_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage_events"
    ADD CONSTRAINT "ai_usage_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_wallet_transactions"
    ADD CONSTRAINT "ai_wallet_transactions_related_usage_event_id_fkey" FOREIGN KEY ("related_usage_event_id") REFERENCES "public"."ai_usage_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_wallet_transactions"
    ADD CONSTRAINT "ai_wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_user_subscriptions"
    ADD CONSTRAINT "app_user_subscriptions_tier_code_fkey" FOREIGN KEY ("tier_code") REFERENCES "public"."app_subscription_tiers"("code");



ALTER TABLE ONLY "public"."app_user_subscriptions"
    ADD CONSTRAINT "app_user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_plan_meta"
    ADD CONSTRAINT "coach_plan_meta_base_state_id_fkey" FOREIGN KEY ("base_state_id") REFERENCES "public"."coach_athlete_state"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."strava_accounts"
    ADD CONSTRAINT "strava_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."account_delete_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities_enrichment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities_laps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities_splits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities_streams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities_summary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."async_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_athlete_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_external_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_plan_daily" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_plan_meta" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_plan_weekly" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_strength_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_insert_own" ON "public"."async_jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_uid"));



CREATE POLICY "jobs_select_own" ON "public"."async_jobs" FOR SELECT USING (("auth"."uid"() = "user_uid"));



CREATE POLICY "notes_delete_own" ON "public"."users_notes" FOR DELETE TO "authenticated" USING (("user_uid" = "auth"."uid"()));



CREATE POLICY "notes_insert_own" ON "public"."users_notes" FOR INSERT TO "authenticated" WITH CHECK (("user_uid" = "auth"."uid"()));



CREATE POLICY "notes_select_own" ON "public"."users_notes" FOR SELECT TO "authenticated" USING (("user_uid" = "auth"."uid"()));



CREATE POLICY "notes_update_own" ON "public"."users_notes" FOR UPDATE TO "authenticated" USING (("user_uid" = "auth"."uid"())) WITH CHECK (("user_uid" = "auth"."uid"()));



ALTER TABLE "public"."profile_metric" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_static" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ub_delete_own" ON "public"."users_bests" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "ub_insert_own" ON "public"."users_bests" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "ub_select_own" ON "public"."users_bests" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "ub_update_own" ON "public"."users_bests" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."account_delete_requests" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."activities_enrichment" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."activities_laps" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."activities_splits" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."activities_streams" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."activities_summary" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_athlete_state" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_external_events" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_feedback" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_plan_daily" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_plan_meta" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_plan_weekly" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."coach_strength_history" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."profile_metric" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."profile_static" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."users_preferences" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."users_recovery" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."users_thresholds" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_delete_own" ON "public"."users_zones" FOR DELETE USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."account_delete_requests" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."activities_enrichment" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."activities_laps" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."activities_splits" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."activities_streams" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."activities_summary" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_athlete_state" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_external_events" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_feedback" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_plan_daily" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_plan_meta" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_plan_weekly" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."coach_strength_history" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."profile_metric" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."profile_static" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."users_preferences" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."users_recovery" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."users_thresholds" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_insert_own" ON "public"."users_zones" FOR INSERT WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."account_delete_requests" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."activities_enrichment" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."activities_laps" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."activities_splits" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."activities_streams" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."activities_summary" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_athlete_state" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_external_events" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_feedback" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_plan_daily" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_plan_meta" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_plan_weekly" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."coach_strength_history" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."profile_metric" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."profile_static" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."users_preferences" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."users_recovery" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."users_thresholds" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_select_own" ON "public"."users_zones" FOR SELECT USING (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."account_delete_requests" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."activities_enrichment" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."activities_laps" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."activities_splits" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."activities_streams" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."activities_summary" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_athlete_state" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_external_events" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_feedback" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_plan_daily" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_plan_meta" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_plan_weekly" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."coach_strength_history" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."profile_metric" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."profile_static" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."users_preferences" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."users_recovery" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."users_thresholds" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



CREATE POLICY "up_update_own" ON "public"."users_zones" FOR UPDATE USING (("user_id" = "public"."app_user_id"())) WITH CHECK (("user_id" = "public"."app_user_id"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users select own" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."users_bests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_recovery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_thresholds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_zones" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."_propagate_sport_type_fe_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."_propagate_sport_type_fe_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_propagate_sport_type_fe_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_set_sport_type_fe_from_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."_set_sport_type_fe_from_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_set_sport_type_fe_from_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."account_hard_delete"("dry_run" boolean, "only_user_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."account_hard_delete"("dry_run" boolean, "only_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."account_hard_delete"("dry_run" boolean, "only_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."account_hard_delete"("dry_run" boolean, "only_user_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON FUNCTION "public"."app_sync_user_profile"("p_auth_uid" "uuid", "p_email" "text", "p_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."app_sync_user_profile"("p_auth_uid" "uuid", "p_email" "text", "p_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_sync_user_profile"("p_auth_uid" "uuid", "p_email" "text", "p_display_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_user_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."auth_user_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."auth_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_deleted_activities"("cutoff_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_activities"("cutoff_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_deleted_activities"("cutoff_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_expired_activity_details"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_expired_activity_details"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_activity_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_activity_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_user_zones_default"("p_user_id" integer, "p_sport" "text", "p_hrmax" integer, "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_user_zones_default"("p_user_id" integer, "p_sport" "text", "p_hrmax" integer, "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_user_zones_default"("p_user_id" integer, "p_sport" "text", "p_hrmax" integer, "p_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sport_type_from_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sport_type_from_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sport_type_from_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_enrichment_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_z1" integer, "p_z2" integer, "p_z3" integer, "p_z4" integer, "p_z5" integer, "p_computed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_enrichment_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_z1" integer, "p_z2" integer, "p_z3" integer, "p_z4" integer, "p_z5" integer, "p_computed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_enrichment_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_z1" integer, "p_z2" integer, "p_z3" integer, "p_z4" integer, "p_z5" integer, "p_computed_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[], "p_altitude" double precision[], "p_speed" double precision[], "p_grade" double precision[], "p_temp" double precision[], "user_jwt" "text", "service" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[], "p_altitude" double precision[], "p_speed" double precision[], "p_grade" double precision[], "p_temp" double precision[], "user_jwt" "text", "service" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_streams_with_sport"("p_user_id" integer, "p_activity_id" bigint, "p_time_s" integer[], "p_heartrate" integer[], "p_cadence" integer[], "p_power" integer[], "p_distance" double precision[], "p_altitude" double precision[], "p_speed" double precision[], "p_grade" double precision[], "p_temp" double precision[], "user_jwt" "text", "service" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."account_delete_requests" TO "anon";
GRANT ALL ON TABLE "public"."account_delete_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."account_delete_requests" TO "service_role";



GRANT ALL ON TABLE "public"."activities_enrichment" TO "anon";
GRANT ALL ON TABLE "public"."activities_enrichment" TO "authenticated";
GRANT ALL ON TABLE "public"."activities_enrichment" TO "service_role";



GRANT ALL ON TABLE "public"."activities_laps" TO "anon";
GRANT ALL ON TABLE "public"."activities_laps" TO "authenticated";
GRANT ALL ON TABLE "public"."activities_laps" TO "service_role";



GRANT ALL ON TABLE "public"."activities_splits" TO "anon";
GRANT ALL ON TABLE "public"."activities_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."activities_splits" TO "service_role";



GRANT ALL ON TABLE "public"."activities_streams" TO "anon";
GRANT ALL ON TABLE "public"."activities_streams" TO "authenticated";
GRANT ALL ON TABLE "public"."activities_streams" TO "service_role";



GRANT ALL ON TABLE "public"."activities_summary" TO "anon";
GRANT ALL ON TABLE "public"."activities_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."activities_summary" TO "service_role";



GRANT ALL ON TABLE "public"."ai_provider_pricing" TO "anon";
GRANT ALL ON TABLE "public"."ai_provider_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_provider_pricing" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_provider_pricing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_provider_pricing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_provider_pricing_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_events" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_usage_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_usage_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_usage_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."ai_wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."ai_wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_wallet_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ai_wallet_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ai_wallet_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ai_wallet_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."app_subscription_tiers" TO "anon";
GRANT ALL ON TABLE "public"."app_subscription_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."app_subscription_tiers" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_subscription_tiers_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_subscription_tiers_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_subscription_tiers_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."app_user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."app_user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user_subscriptions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_user_subscriptions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_user_subscriptions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_user_subscriptions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."async_jobs" TO "anon";
GRANT ALL ON TABLE "public"."async_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."async_jobs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."async_jobs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."async_jobs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."async_jobs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_athlete_state" TO "anon";
GRANT ALL ON TABLE "public"."coach_athlete_state" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_athlete_state" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_athlete_state_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_athlete_state_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_athlete_state_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_external_events" TO "anon";
GRANT ALL ON TABLE "public"."coach_external_events" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_external_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_external_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_external_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_external_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_feedback" TO "anon";
GRANT ALL ON TABLE "public"."coach_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_feedback" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_feedback_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_feedback_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_feedback_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_plan_daily" TO "anon";
GRANT ALL ON TABLE "public"."coach_plan_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_plan_daily" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_plan_daily_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_plan_daily_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_plan_daily_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_plan_meta" TO "anon";
GRANT ALL ON TABLE "public"."coach_plan_meta" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_plan_meta" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_plan_meta_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_plan_meta_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_plan_meta_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_plan_weekly" TO "anon";
GRANT ALL ON TABLE "public"."coach_plan_weekly" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_plan_weekly" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_plan_weekly_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_plan_weekly_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_plan_weekly_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."coach_strength_history" TO "anon";
GRANT ALL ON TABLE "public"."coach_strength_history" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_strength_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."coach_strength_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."coach_strength_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."coach_strength_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_metric" TO "anon";
GRANT ALL ON TABLE "public"."profile_metric" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_metric" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_metric_value_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_metric_value_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_metric_value_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profile_static" TO "anon";
GRANT ALL ON TABLE "public"."profile_static" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_static" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_static_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_static_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_static_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."runners_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."strava_accounts" TO "anon";
GRANT ALL ON TABLE "public"."strava_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_accounts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."strava_accounts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."strava_accounts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."strava_accounts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."strava_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."strava_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."strava_webhook_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."strava_webhook_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."strava_webhook_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."strava_webhook_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users_bests" TO "anon";
GRANT ALL ON TABLE "public"."users_bests" TO "authenticated";
GRANT ALL ON TABLE "public"."users_bests" TO "service_role";



GRANT ALL ON TABLE "public"."users_notes" TO "anon";
GRANT ALL ON TABLE "public"."users_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."users_notes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_notes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_notes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_notes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users_preferences" TO "anon";
GRANT ALL ON TABLE "public"."users_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."users_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."users_recovery" TO "anon";
GRANT ALL ON TABLE "public"."users_recovery" TO "authenticated";
GRANT ALL ON TABLE "public"."users_recovery" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_recovery_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_recovery_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_recovery_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users_thresholds" TO "anon";
GRANT ALL ON TABLE "public"."users_thresholds" TO "authenticated";
GRANT ALL ON TABLE "public"."users_thresholds" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_thresholds_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_thresholds_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_thresholds_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users_zones" TO "anon";
GRANT ALL ON TABLE "public"."users_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."users_zones" TO "service_role";



GRANT ALL ON SEQUENCE "public"."users_zones_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."users_zones_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."users_zones_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






