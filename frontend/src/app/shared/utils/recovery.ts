// src/shared/utils/recovery.ts

import {
  toISODateLoose,
  todayLocalISO,
  formatSk,
} from "@/app/shared/utils/time";

export function avg(xs: number[]) {
  const a = xs.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}

export function pctDiff(curr: number, base: number) {
  if (!isFinite(curr) || !isFinite(base) || base === 0) return 0;
  return (curr - base) / base;
}

export type DayPoint = {
  date: string;
  value: number | null;
  comment?: string | null;
};

/** Rolling mean z predchádzajúcich dní (deň D nepočíta do baseline). */
export function rollingMean(
  values: (number | null)[],
  windowDays = 14
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const buf: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    buf.push(v);
    if (buf.length > windowDays) buf.shift();

    const prev = buf.slice(0, Math.max(0, buf.length - 1));
    let psum = 0,
      pcnt = 0;
    for (const x of prev)
      if (typeof x === "number") {
        psum += x;
        pcnt++;
      }
    out[i] = pcnt ? psum / pcnt : null;
  }
  return out;
}

export function bandsAround(baseline: (number | null)[], pct = 0.05) {
  const lower = baseline.map((b) =>
    typeof b === "number" ? b * (1 - pct) : null
  );
  const upper = baseline.map((b) =>
    typeof b === "number" ? b * (1 + pct) : null
  );
  return { lower, upper };
}

/** Jednoduchý wrapper: baseline + ±pct pásma + posledná baseline hodnota. */
export function makeRollingBaseline(
  values: (number | null)[],
  windowDays = 14,
  bandPct = 0.05
): {
  baseline: (number | null)[];
  lower: (number | null)[];
  upper: (number | null)[];
} {
  const baseline = rollingMean(values, windowDays);
  const { lower, upper } = bandsAround(baseline, bandPct);
  return { baseline, lower, upper };
}

export function compareLatestToBaseline(
  latest: number | null | undefined,
  baseline: number | null | undefined,
  kind: "lower-better" | "higher-better" = "lower-better",
  tolPct = 0.05
): { note: string; accent: "bg-emerald-600" | "bg-amber-600" | "bg-sky-600" } {
  if (!(typeof latest === "number") || !(typeof baseline === "number")) {
    return { note: "Bez dát.", accent: "bg-slate-700" as any };
  }
  const diff = (latest - baseline) / baseline;
  if (kind === "lower-better") {
    if (diff <= -tolPct)
      return {
        note: "Včerajší RHR bol LEPŠÍ než priemer (↓)",
        accent: "bg-emerald-600",
      };
    if (diff >= tolPct)
      return {
        note: "Včerajší RHR bol HORŠÍ než priemer (↑)",
        accent: "bg-amber-600",
      };
    return { note: "Včerajší RHR bol V PRIEMERE", accent: "bg-sky-600" };
  } else {
    if (diff >= tolPct)
      return {
        note: "Včerajšia hodnota bola LEPŠIA než priemer (↑)",
        accent: "bg-emerald-600",
      };
    if (diff <= -tolPct)
      return {
        note: "Včerajšia hodnota bola HORŠIA než priemer (↓)",
        accent: "bg-amber-600",
      };
    return { note: "Včerajšia hodnota bola V PRIEMERE", accent: "bg-sky-600" };
  }
}

/** vyhladí okrajové null tak, aby fill medzi dvomi líniami nespadol */
export function solidifyForBand(a: (number | null)[]): number[] {
  const out = [...a] as (number | null)[];
  // dopredu – doplň prvé non-null naspäť
  let first: number | null = null;
  for (let i = 0; i < out.length; i++) {
    if (typeof out[i] === "number") {
      first = out[i] as number;
      break;
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i] == null) out[i] = first;
    else break;
  }
  // dozadu – doplň poslednú známu dopredu
  let last: number | null = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (typeof out[i] === "number") {
      last = out[i] as number;
      break;
    }
  }
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] == null) out[i] = last;
    else break;
  }
  // vnútorné null necháme (Chart.js si poradí so spanGaps)
  return out.map((v) => (typeof v === "number" ? v : last ?? first ?? 0));
}

/** pásmo ±pct okolo baseline, pripravené na fill (bez okrajových null) */
export function bandFromBaseline(baseline: (number | null)[], pct = 0.05) {
  const solid = solidifyForBand(baseline);
  const lower = solid.map((b) => b * (1 - pct));
  const upper = solid.map((b) => b * (1 + pct));
  return { lower, upper };
}

/** zalomenie textu po maxN znakoch tak, aby sa slovám nelámali písmená */
export function wrapToLines(text?: string | null, max = 44): string[] {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const out: string[] = [];
  let curr = "";
  for (const w of words) {
    const tryAdd = curr ? curr + " " + w : w;
    if (tryAdd.length > max) {
      if (curr) out.push(curr);
      if (w.length > max) {
        out.push(w);
        curr = "";
      } // extra dlhé „slovo“
      else {
        curr = w;
      }
    } else {
      curr = tryAdd;
    }
  }
  if (curr) out.push(curr);
  return out;
}

export type FreshnessResult = {
  hasToday: boolean; // či už je záznam za dnešok
  latestISO: string | null; // posledný vložený dátum
  daysAgo: number | null; // koľko dní dozadu je posledný záznam
  message: string; // hotový text pre widget (prázdny ak je všetko OK)
};

/**
 * Zistí „čerstvosť“ recovery dát.
 * @param rows    - pole riadkov z DB
 * @param getDate - extractor, ktorý vráti `date`/`created_at`/pod.
 */
export function checkRecoveryFreshness<T>(
  rows: T[],
  getDate: (row: T) => string | Date | null | undefined
): FreshnessResult {
  const today = todayLocalISO();
  let latest: string | null = null;

  for (const r of rows) {
    const iso = toISODateLoose(getDate(r));
    if (!iso) continue;
    if (!latest || iso > latest) latest = iso; // porovnanie ISO stringov funguje lexikograficky
  }

  if (!latest) {
    return {
      hasToday: false,
      latestISO: null,
      daysAgo: null,
      message: "Chýbajú dáta (zatím žiadny záznam).",
    };
  }

  if (latest === today) {
    return { hasToday: true, latestISO: latest, daysAgo: 0, message: "" };
  }

  // rozdiel dní (len približne po dňoch; stačí na widget)
  const start = new Date(latest + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  const days = Math.round((+end - +start) / (24 * 3600 * 1000));

  return {
    hasToday: false,
    latestISO: latest,
    daysAgo: days,
    message: `Chýbajú dáta za dnešok. Posledný záznam: ${formatSk(latest)}.`,
  };
}

/** Vráti posledný baseline bod (klzavý priemer) – často stačí pre widget. */
export function makeBaselinePoint(
  values: (number | null)[],
  windowDays = 14,
  excludeLast = true // pre widgety chceme baseline bez "včerajška"
): number | null {
  const src = excludeLast ? values.slice(0, -1) : values;
  if (!src.length) return null;
  const { baseline } = makeRollingBaseline(src, windowDays, 0.05);
  const last = baseline.at(-1);
  return typeof last === "number" ? last : null;
}

/** Porovnanie „času v minútach“ voči baseline s toleranciou v minútach. */
export function compareTimeToBaselineMinutes(
  latestMin: number | null | undefined,
  baselineMin: number | null | undefined,
  tolMinutes = 30
): { note: string; accent: "bg-emerald-600" | "bg-amber-600" | "bg-sky-600" } {
  if (!(typeof latestMin === "number") || !(typeof baselineMin === "number")) {
    return { note: "Bez dát.", accent: "bg-slate-700" as any };
  }
  const diff = latestMin - baselineMin;
  const abs = Math.abs(diff);
  if (abs <= tolMinutes)
    return {
      note: "Čas zaspania bol V PRIEMERE (±30 min)",
      accent: "bg-sky-600",
    };
  if (diff < 0)
    return { note: "Zaspal si SKÔR než obvykle", accent: "bg-emerald-600" };
  return { note: "Zaspal si NESKÔR než obvykle", accent: "bg-amber-600" };
}
