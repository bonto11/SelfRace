// src/features/activity/utils/activity.ts
"use client";

import { isoDate } from "@/shared/utils/recovery";

/** Ľahký rad pre listy/grafy (90d range) */
export interface ActivityRow {
  activity_id: number;
  name: string;
  date: string; // ISO (YYYY-MM-DD)
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  // voliteľne – ak by API niekde malo TRIMP (ak nie, nechávame null)
  trimp: number | null;
}

/** Extra detail (doťahuje sa len na klik) */
export interface ActivityDetailExtra {
  laps: any[];
  splits: any[];
}


/** Týždenná agregácia pre grafy a summary */
export type Metric = "km" | "time" | "trimp";
export interface WeekRow {
  week: string; // "YYYY-Www"
  label: string; // napr. "1.–7.10."
  start: string; // ISO
  end: string; // ISO
  // km
  km_run: number;
  km_ride: number;
  km_mixed: number;
  km_skate: number;
  // time (min)
  time_run_min: number;
  time_ride_min: number;
  time_strength_min: number;
  time_mixed_min: number;
  time_skate_min: number;
  time_other_min: number;
  // trimp (ak nemáme, bude 0)
  trimp_run: number;
  trimp_ride: number;
  trimp_strength: number;
  trimp_mixed: number;
  trimp_skate: number;
  trimp_other: number;
  // monotony/strain pre každý metric
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
}

/* --------------------- normalizácia range payloadu --------------------- */
export function normalizeActivityRow(r: any): ActivityRow | null {
  const id = Number(r?.activity_id ?? r?.id);
  if (!Number.isFinite(id)) return null;
  return {
    activity_id: id,
    name: String(r?.name ?? "").trim(),
    date: isoDate(r?.date ?? r?.start_date_local ?? r?.start_date),
    sport_type: r?.sport_type ?? null,
    sport_type_fe: r?.sport_type_fe ?? null,
    sport_type_ovrd: r?.sport_type_ovrd ?? null,
    distance_m: numOrNull(r?.distance_m ?? r?.distance),
    moving_time_s: numOrNull(r?.moving_time_s ?? r?.moving_time),
    average_heartrate_bpm: numOrNull(r?.average_heartrate_bpm ?? r?.avg_hr),
    max_heartrate_bpm: numOrNull(r?.max_heartrate_bpm ?? r?.max_hr),
    trimp: numOrNull(r?.trimp), // často null – nevadí
  };
}

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* --------------------- dátumové utily --------------------- */
export function addDays(iso: string, d: number): string {
  const dt = new Date(iso + "T00:00:00");
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** ISO týždeň (Po–Ne) vo formáte YYYY-Www + start/end tohto týždňa. */
export function isoWeekInfo(iso: string) {
  const dt = new Date(iso + "T00:00:00Z");
  // dostať sa na najbližší pondelok (Mon=1)
  const day = dt.getUTCDay() || 7; // Sun=0 -> 7
  const mon = new Date(dt);
  mon.setUTCDate(dt.getUTCDate() - day + 1);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  const start = mon.toISOString().slice(0, 10);
  const end = sun.toISOString().slice(0, 10);

  // číslo týždňa
  const year = mon.getUTCFullYear();
  const week = isoWeekNumber(mon);
  const weekKey = `${year}-W${String(week).padStart(2, "0")}`;

  const label = rangeLabel(start, end);
  return { weekKey, start, end, label };
}

function isoWeekNumber(d: Date): number {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  // Thursday in current week decides the year.
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return weekNo;
}

export function rangeLabel(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  const sd = s.getUTCDate(),
    sm = s.getUTCMonth() + 1;
  const ed = e.getUTCDate(),
    em = e.getUTCMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}

/* --------------------- kategorizácia športu --------------------- */
export type EffSport =
  | "run"
  | "ride"
  | "strength"
  | "mixed"
  | "skate"
  | "other";
export function toEffSportKey(
  row: Pick<ActivityRow, "sport_type" | "sport_type_fe" | "sport_type_ovrd">
): EffSport {
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
      bySport: Record<EffSport, { km: number; min: number; trimp: number }>;
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
      bySportKm: Record<EffSport, number>;
      bySportMin: Record<EffSport, number>;
      bySportTrimp: Record<EffSport, number>;
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
    (Object.keys(wk.bySportKm) as EffSport[]).forEach((sp) => {
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

function monotony(vals: number[]): number | undefined {
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

export type ComponentVariant = "activity" | "calendar" | "pb";
