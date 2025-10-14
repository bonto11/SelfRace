// src/shared/utils/recovery.ts
export function avg(xs: number[]) {
  const a = xs.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}

export function pctDiff(curr: number, base: number) {
  if (!isFinite(curr) || !isFinite(base) || base === 0) return 0;
  return (curr - base) / base;
}

export function minutesToHhMm(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h * 60 + min;
}

export function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(1439, Math.round(total)));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type DayPoint = { date: string; value: number | null; comment?: string | null };

/** Rolling mean z predchádzajúcich dní (deň D nepočíta do baseline). */
export function rollingMean(values: (number | null)[], windowDays = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  const buf: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    buf.push(v);
    if (buf.length > windowDays) buf.shift();

    const prev = buf.slice(0, Math.max(0, buf.length - 1));
    let psum = 0, pcnt = 0;
    for (const x of prev) if (typeof x === "number") { psum += x; pcnt++; }
    out[i] = pcnt ? psum / pcnt : null;
  }
  return out;
}

export function bandsAround(baseline: (number | null)[], pct = 0.05) {
  const lower = baseline.map(b => (typeof b === "number" ? b * (1 - pct) : null));
  const upper = baseline.map(b => (typeof b === "number" ? b * (1 + pct) : null));
  return { lower, upper };
}

/** Jednoduchý wrapper: baseline + ±pct pásma + posledná baseline hodnota. */
export function makeRollingBaseline(
  values: (number | null)[],
  windowDays = 14,
  pct = 0.05
) {
  const baseline = rollingMean(values, windowDays);
  const { lower, upper } = bandsAround(baseline, pct);
  const latestBaseline =
    baseline.length ? baseline[baseline.length - 1] ?? null : null;
  return { baseline, lower, upper, latestBaseline };
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
    if (diff <= -tolPct) return { note: "Včerajší RHR bol LEPŠÍ než priemer (↓)", accent: "bg-emerald-600" };
    if (diff >=  tolPct) return { note: "Včerajší RHR bol HORŠÍ než priemer (↑)", accent: "bg-amber-600" };
    return { note: "Včerajší RHR bol V PRIEMERE", accent: "bg-sky-600" };
  } else {
    if (diff >=  tolPct) return { note: "Včerajšia hodnota bola LEPŠIA než priemer (↑)", accent: "bg-emerald-600" };
    if (diff <= -tolPct) return { note: "Včerajšia hodnota bola HORŠIA než priemer (↓)", accent: "bg-amber-600" };
    return { note: "Včerajšia hodnota bola V PRIEMERE", accent: "bg-sky-600" };
  }
}

export function isoDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}
// alias – niektoré importy volajú toISODate
export const toISODate = isoDate;

// pondelok?
export function isMonday(dateIso: string) {
  const d = new Date(dateIso + "T00:00:00");
  const wd = d.getDay(); // 0=NE, 1=PO
  return wd === 1;
}

// „6–12.10.“ z pondelka
export function formatWeekRange(startIso: string) {
  const s = new Date(startIso + "T00:00:00");
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  const sd = s.getDate(), sm = s.getMonth() + 1;
  const ed = e.getDate(), em = e.getMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}
