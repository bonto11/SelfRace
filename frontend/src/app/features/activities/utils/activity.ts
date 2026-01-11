// src/features/activities/utils/activity.ts
"use client";
import { THEME } from "@/app/shared/theme/tokens";
import { isoDate, isoWeekInfo } from "@/app/shared/utils/time";
import {
  ActivityRow,
  SportFE,
  WeekRow,
  Metric,
} from "@/app/features/activities/types/activities";

/* --------------------- normalizácia range payloadu --------------------- */
export function normalizeActivityRow(r: any): ActivityRow | null {
  const id = Number(r?.activity_id ?? r?.id);
  if (!Number.isFinite(id)) return null;

  // ľahký debug – ak ťa to bude otravovať, môžeš zmazať / zakomentovať
  if (typeof window !== "undefined" && (window as any).__DEBUG_ACT_SUMMARY__) {
    // @ts-ignore
    console.debug("[normalizeActivityRow] raw row:", r);
  }

  const date = isoDate(r?.date ?? r?.start_date_local ?? r?.start_date);

  const distance_m = numOrNull(r?.distance_m ?? r?.distance);
  const moving_time_s = numOrNull(r?.moving_time_s ?? r?.moving_time);
  const elapsed_time_s = numOrNull(r?.elapsed_time_s ?? r?.elapsed_time);

  const average_speed_mps = numOrNull(
    r?.average_speed_mps ?? r?.avg_speed ?? r?.average_speed
  );
  const max_speed_mps = numOrNull(
    r?.max_speed_mps ?? r?.max_speed ?? r?.max_speed_mps
  );

  const average_heartrate_bpm = numOrNull(
    r?.average_heartrate_bpm ?? r?.avg_hr ?? r?.average_heartrate
  );
  const max_heartrate_bpm = numOrNull(
    r?.max_heartrate_bpm ?? r?.max_hr ?? r?.max_heartrate
  );

  const elevation_gain_m = numOrNull(
    r?.elevation_gain_m ?? r?.total_elevation_gain
  );
  const elev_high_m = numOrNull(r?.elev_high_m ?? r?.elev_high);
  const elev_low_m = numOrNull(r?.elev_low_m ?? r?.elev_low);

  const average_cadence_rpm = numOrNull(
    r?.average_cadence_rpm ?? r?.avg_cadence ?? r?.cadence
  );
  const average_temp_c = numOrNull(
    r?.average_temp_c ?? r?.average_temp ?? r?.temp
  );
  const average_watts = numOrNull(
    r?.average_watts ??
      r?.weighted_average_watts ??
      r?.avg_watts ??
      r?.average_power
  );
  const max_watts = numOrNull(r?.max_watts);

  const calories_kcal = numOrNull(r?.calories_kcal ?? r?.calories);

  const achievement_count = numOrNull(r?.achievement_count);
  const pr_count = numOrNull(r?.pr_count);

  const workout_type = numOrNull(r?.workout_type);

  // map polylines – buď priamo z DB stĺpcov, alebo z vnoreného map objektu
  const map_summary_polyline =
    typeof r?.map_summary_polyline === "string"
      ? r.map_summary_polyline
      : typeof r?.map?.summary_polyline === "string"
      ? r.map.summary_polyline
      : null;

  const map_polyline =
    typeof r?.map_polyline === "string"
      ? r.map_polyline
      : typeof r?.map?.polyline === "string"
      ? r.map.polyline
      : null;

  const gear_id =
    typeof r?.gear_id === "string"
      ? r.gear_id
      : typeof r?.gear?.id === "string"
      ? r.gear.id
      : null;

  const gear_name =
    typeof r?.gear_name === "string"
      ? r.gear_name
      : typeof r?.gear?.name === "string"
      ? r.gear.name
      : null;

  const timezone =
    typeof r?.timezone === "string" ? r.timezone : r?.timezone ?? null;
  const utc_offset_s = numOrNull(r?.utc_offset_s ?? r?.utc_offset);

  const trimp = numOrNull(r?.trimp);

  // nové polia z DB
  const user_id = numOrNull(r?.user_id);
  const user_uid =
    typeof r?.user_uid === "string" ? r.user_uid : r?.user_uid ?? null;

  const description =
    typeof r?.description === "string" ? r.description : null;
  const comment = typeof r?.comment === "string" ? r.comment : null;

  const pace_seconds_per_km = numOrNull(
    r?.pace_seconds_per_km ??
      r?.pace_s_per_km ??
      r?.avg_pace_sec_per_km ??
      r?.avg_pace_s
  );

  const deleted_at =
    typeof r?.deleted_at === "string" ? r.deleted_at : r?.deleted_at ?? null;

  return {
    activity_id: id,
    name: String(r?.name ?? "").trim(),
    date,

    sport_type: r?.sport_type ?? null,
    sport_type_fe: r?.sport_type_fe ?? null,
    sport_type_ovrd: r?.sport_type_ovrd ?? null,

    distance_m,
    moving_time_s,
    elapsed_time_s,

    average_speed_mps,
    max_speed_mps,

    average_heartrate_bpm,
    max_heartrate_bpm,

    elevation_gain_m,
    elev_high_m,
    elev_low_m,

    average_cadence_rpm,
    average_temp_c,
    average_watts,
    max_watts,

    calories_kcal,
    achievement_count,
    pr_count,

    gear_id,
    gear_name,

    timezone,
    utc_offset_s,

    user_id,
    user_uid,
    description,
    comment,
    pace_seconds_per_km,
    deleted_at: deleted_at ?? null,

    workout_type,
    map_summary_polyline,
    map_polyline,

    trimp,
  };
}

export function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* --------------------- kategorizácia športu --------------------- */

export function toEffSportKey(
  row: Pick<ActivityRow, "sport_type" | "sport_type_fe" | "sport_type_ovrd">
): SportFE {
  const s = (
    row.sport_type_ovrd ??
    row.sport_type_fe ??
    row.sport_type ??
    ""
  ).toLowerCase();
  if (/run/.test(s)) return "run";
  if (/ride|bike|cycling/.test(s)) return "ride";
  if (/strength|gym|weights/.test(s)) return "strength";
  if (/skate/.test(s)) return "skate";
  if (/hike|walk|row|swim|yoga/.test(s)) return "other";
  if (/mixed|circuit/.test(s)) return "mixed";
  return "other";
}

/* --------------------- týždenné agregácie --------------------- */
// ... (zvyšok súboru nechávam tak ako si ho mal, nič sme tam nemenili)