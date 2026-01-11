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

  // ak chceš raw debug, v konzole si zapni:
  // (window as any).__DEBUG_ACT_SUMMARY__ = true;
  if (typeof window !== "undefined" && (window as any).__DEBUG_ACT_SUMMARY__) {
    // eslint-disable-next-line no-console
    console.debug("[normalizeActivityRow] raw row:", r);
  }

  const date = isoDate(r?.date ?? r?.start_date_local ?? r?.start_date);

  // distance / time
  const distance_m = numOrNull(r?.distance_m ?? r?.distance);
  const moving_time_s = numOrNull(r?.moving_time_s ?? r?.moving_time);
  const elapsed_time_s = numOrNull(r?.elapsed_time_s ?? r?.elapsed_time);

  // speed
  const average_speed_mps = numOrNull(
    r?.average_speed_mps ?? r?.avg_speed ?? r?.average_speed
  );
  const max_speed_mps = numOrNull(
    r?.max_speed_mps ?? r?.max_speed ?? r?.max_speed_mps
  );

  // HR
  const average_heartrate_bpm = numOrNull(
    r?.average_heartrate_bpm ?? r?.avg_hr ?? r?.average_heartrate
  );
  const max_heartrate_bpm = numOrNull(
    r?.max_heartrate_bpm ?? r?.max_hr ?? r?.max_heartrate
  );

  // elevation
  const elevation_gain_m = numOrNull(
    r?.elevation_gain_m ?? r?.total_elevation_gain
  );
  const elev_high_m = numOrNull(r?.elev_high_m ?? r?.elev_high);
  const elev_low_m = numOrNull(r?.elev_low_m ?? r?.elev_low);

  // cadence / temp / power
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

  // energy / stats
  const calories_kcal = numOrNull(r?.calories_kcal ?? r?.calories);
  const achievement_count = numOrNull(r?.achievement_count);
  const pr_count = numOrNull(r?.pr_count);

  // workout
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

  // gear
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

  // timezone
  const timezone =
    typeof r?.timezone === "string" ? r.timezone : r?.timezone ?? null;
  const utc_offset_s = numOrNull(r?.utc_offset_s ?? r?.utc_offset);

  // TRIMP / interné
  const trimp = numOrNull(r?.trimp);

  // nové polia z DB – aby mal SessionCard úplný obraz
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

export function aggregateWeeks(rows: ActivityRow[]): WeekRow[] {
  // denné koše pre km/time/trimp
  const daily = new Map<
    string,
    {
      km: number;
      time: number;
      trimp: number;
      bySport: Record<SportFE, { km: number; min: number; trimp: number }>;
    }
  >();

  const ensure = (iso: string) => {
    if (!daily.has(iso)) {
      daily.set(iso, {
        km: 0,
        time: 0,
        trimp: 0,
        bySport: {
          run: { km: 0, min: 0, trimp: 0 },
          ride: { km: 0, min: 0, trimp: 0 },
          strength: { km: 0, min: 0, trimp: 0 },
          mixed: { km: 0, min: 0, trimp: 0 },
          skate: { km: 0, min: 0, trimp: 0 },
          other: { km: 0, min: 0, trimp: 0 },
        },
      });
    }
    return daily.get(iso)!;
  };

  for (const r of rows) {
    const d = ensure(r.date);
    const sp = toEffSportKey(r);
    const km = (r.distance_m ?? 0) / 1000;
    const min = Math.round((r.moving_time_s ?? 0) / 60);
    const tr = r.trimp ?? 0;

    d.km += km;
    d.time += min;
    d.trimp += tr;

    d.bySport[sp].km += km;
    d.bySport[sp].min += min;
    d.bySport[sp].trimp += tr;
  }

  // skupiny podľa ISO týždňa
  const weeks = new Map<
    string,
    {
      days: string[];
      start: string;
      end: string;
      label: string;
      // súčty
      bySportKm: Record<SportFE, number>;
      bySportMin: Record<SportFE, number>;
      bySportTrimp: Record<SportFE, number>;
    }
  >();

  [...daily.keys()].sort().forEach((iso) => {
    const info = isoWeekInfo(iso);
    if (!weeks.has(info.weekKey)) {
      weeks.set(info.weekKey, {
        days: [],
        start: info.start,
        end: info.end,
        label: info.label,
        bySportKm: {
          run: 0,
          ride: 0,
          strength: 0,
          mixed: 0,
          skate: 0,
          other: 0,
        },
        bySportMin: {
          run: 0,
          ride: 0,
          strength: 0,
          mixed: 0,
          skate: 0,
          other: 0,
        },
        bySportTrimp: {
          run: 0,
          ride: 0,
          strength: 0,
          mixed: 0,
          skate: 0,
          other: 0,
        },
      });
    }
    const wk = weeks.get(info.weekKey)!;
    wk.days.push(iso);

    const d = daily.get(iso)!;
    (Object.keys(wk.bySportKm) as SportFE[]).forEach((sp) => {
      wk.bySportKm[sp] += d.bySport[sp].km;
      wk.bySportMin[sp] += d.bySport[sp].min;
      wk.bySportTrimp[sp] += d.bySport[sp].trimp;
    });
  });

  // Monotony/Strain: pre každú metriku zober 7 denné hodnoty v týždni
  const out: WeekRow[] = [];
  for (const [weekKey, wk] of weeks) {
    const kmDaily = wk.days.map((d) => daily.get(d)!.km);
    const timeDaily = wk.days.map((d) => daily.get(d)!.time);
    const trDaily = wk.days.map((d) => daily.get(d)!.trimp);

    const mono: Record<Metric, number | undefined> = {
      km: monotony(kmDaily),
      time: monotony(timeDaily),
      trimp: trDaily.every((v) => v === 0) ? undefined : monotony(trDaily),
    };

    const strainVal = (vals: number[], m?: number) =>
      m && sum(vals) > 0 ? sum(vals) * m : undefined;

    out.push({
      week: weekKey,
      label: wk.label,
      start: wk.start,
      end: wk.end,
      km_run: wk.bySportKm.run,
      km_ride: wk.bySportKm.ride,
      km_mixed: wk.bySportKm.mixed,
      km_skate: wk.bySportKm.skate,
      time_run_min: wk.bySportMin.run,
      time_ride_min: wk.bySportMin.ride,
      time_strength_min: wk.bySportMin.strength,
      time_mixed_min: wk.bySportMin.mixed,
      time_skate_min: wk.bySportMin.skate,
      time_other_min: wk.bySportMin.other,
      trimp_run: wk.bySportTrimp.run,
      trimp_ride: wk.bySportTrimp.ride,
      trimp_strength: wk.bySportTrimp.strength,
      trimp_mixed: wk.bySportTrimp.mixed,
      trimp_skate: wk.bySportTrimp.skate,
      trimp_other: wk.bySportTrimp.other,
      monotony: { km: mono.km, time: mono.time, trimp: mono.trimp },
      strain: {
        km: strainVal(kmDaily, mono.km),
        time: strainVal(timeDaily, mono.time),
        trimp: trDaily.every((v) => v === 0)
          ? undefined
          : strainVal(trDaily, mono.trimp),
      },
    });
  }

  // zoradiť podľa začiatku týždňa
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}

export function monotony(vals: number[]): number | undefined {
  if (!vals.length) return undefined;
  const m = mean(vals);
  const s = stddev(vals, m);
  if (s === 0) return undefined; // všetko rovnaké → nedefinované
  return round2(m / s);
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);

function stddev(a: number[], m: number) {
  const v = a.reduce((s, x) => s + Math.pow(x - m, 2), 0) / a.length;
  return Math.sqrt(v);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[activityApi] JSON parse error, raw:", text.slice(0, 400));
    throw e;
  }
}

export function normSportsList(
  sel: string | string[] | null | undefined
): string[] | null {
  if (sel == null) return null;
  if (Array.isArray(sel)) {
    const arr = sel.map((s) => String(s).trim().lowerCase()).filter(Boolean);
    if (arr.length === 0) return null;
    if (arr.length === 1 && arr[0] === "all") return null;
    return Array.from(new Set(arr));
  }
  const raw = String(sel).trim().toLowerCase();
  if (!raw || raw === "all") return null;
  const arr = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : null;
}

export function toEffSport(row: {
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
}): string {
  const s = (row.sport_type_ovrd ?? row.sport_type_fe ?? row.sport_type ?? "")
    .toString()
    .toLowerCase();

  if (!s) return "other";
  if (s.includes("run")) return "run";
  if (s.includes("ride") || s.includes("bike") || s.includes("cycle"))
    return "ride";
  if (s.includes("strength") || s.includes("weight") || s.includes("gym"))
    return "strength";
  if (s.includes("skate")) return "skate";
  if (s.includes("mix")) return "mixed";
  if (s.includes("walk")) return "walk";
  if (s.includes("hike")) return "hike";
  if (s.includes("swim")) return "swim";
  return s;
}

export function sportUiLabel(s: string): string {
  const L = THEME.sportLabels;
  return L[s] || s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}