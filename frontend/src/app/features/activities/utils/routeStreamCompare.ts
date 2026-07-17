// src/app/features/activities/utils/routeStreamCompare.ts

export type RawStreams = {
  time_s?: number[];
  distance_m?: (number | null)[];
  hr?: (number | null)[];
  altitude_m?: (number | null)[];
};

export type ResampledSeries = {
  distanceKm: number;
  hr: number | null;
  paceSecPerKm: number | null;
  elevation: number | null;
};

/**
 * Prevzorkuje jeden beh (raw streams) na pevné kilometrové kroky, aby sa dal
 * porovnať s iným behom rovnakej trate v jednom grafe (spoločná os X = km).
 * - HR a elevation: lineárna interpolácia najbližších dvoch vzoriek podľa distance_m
 * - Tempo: počítané z lokálneho okna (rozdiel distance/time medzi dvoma
 *   susednými km krokmi), nie priama interpolácia bodovej rýchlosti
 */
export function resampleStreamByDistance(
  raw: RawStreams,
  stepKm: number = 0.25,
): ResampledSeries[] {
  const time = raw.time_s ?? [];
  const dist = raw.distance_m ?? [];
  const hr = raw.hr ?? [];
  const alt = raw.altitude_m ?? [];

  if (!time.length || !dist.length) return [];

  // Filtrujeme len indexy kde máme platnú (rastúcu) vzdialenosť
  const points: { d: number; t: number; hr: number | null; alt: number | null }[] = [];
  let lastD = -1;
  for (let i = 0; i < time.length; i++) {
    const d = dist[i];
    if (d == null || !Number.isFinite(d) || d < lastD) continue;
    points.push({
      d: d / 1000,
      t: time[i],
      hr: hr[i] ?? null,
      alt: alt[i] ?? null,
    });
    lastD = d;
  }

  if (points.length < 2) return [];

  const maxKm = points[points.length - 1].d;
  const out: ResampledSeries[] = [];

  const findSurrounding = (targetKm: number) => {
    // Binárne by bolo rýchlejšie, ale streamy nie sú extrémne veľké (tisícky bodov)
    let lo = points[0];
    let hi = points[points.length - 1];
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].d <= targetKm && points[i + 1].d >= targetKm) {
        lo = points[i];
        hi = points[i + 1];
        break;
      }
    }
    return { lo, hi };
  };

  const interp = (targetKm: number, lo: typeof points[0], hi: typeof points[0], key: "hr" | "alt") => {
    const a = lo[key];
    const b = hi[key];
    if (a == null || b == null) return a ?? b ?? null;
    if (hi.d === lo.d) return a;
    const frac = (targetKm - lo.d) / (hi.d - lo.d);
    return a + (b - a) * frac;
  };

  for (let km = 0; km <= maxKm; km += stepKm) {
    const { lo, hi } = findSurrounding(km);

    const hrVal = interp(km, lo, hi, "hr");
    const altVal = interp(km, lo, hi, "alt");

    // Tempo z lokálneho okna okolo tohto km bodu (predošlý step -> tento step)
    const prevKm = Math.max(0, km - stepKm);
    const { lo: pLo, hi: pHi } = findSurrounding(prevKm);
    const tAtPrev =
      pHi.d === pLo.d ? pLo.t : pLo.t + (pHi.t - pLo.t) * ((prevKm - pLo.d) / (pHi.d - pLo.d));
    const tAtCur = hi.d === lo.d ? lo.t : lo.t + (hi.t - lo.t) * ((km - lo.d) / (hi.d - lo.d));

    const dtSec = tAtCur - tAtPrev;
    const ddKm = km - prevKm;
    const paceSecPerKm = dtSec > 0 && ddKm > 0 ? dtSec / ddKm : null;

    out.push({
      distanceKm: Math.round(km * 100) / 100,
      hr: hrVal != null ? Math.round(hrVal) : null,
      paceSecPerKm:
        paceSecPerKm != null && paceSecPerKm > 0 && paceSecPerKm < 1200 ? paceSecPerKm : null,
      elevation: altVal != null ? Math.round(altVal) : null,
    });
  }

  return out;
}

/**
 * Zlúči viacero prevzorkovaných sérií (rôzne aktivity) do jedného poľa riadkov
 * podľa distanceKm, pripravené priamo pre recharts (jeden riadok na km krok,
 * kľúče "hr_0", "pace_0", "hr_1", "pace_1", ... podľa indexu aktivity).
 */
export function mergeSeriesForChart(
  seriesList: ResampledSeries[][],
): Record<string, any>[] {
  const maxLen = Math.max(...seriesList.map((s) => s.length), 0);
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, any> = {
      distanceKm: seriesList[0]?.[i]?.distanceKm ?? null,
    };
    seriesList.forEach((series, idx) => {
      const point = series[i];
      row[`hr_${idx}`] = point?.hr ?? null;
      row[`pace_${idx}`] = point?.paceSecPerKm ?? null;
      row[`elevation_${idx}`] = point?.elevation ?? null;
    });
    rows.push(row);
  }

  return rows;
}

export function average(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
