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

type Point = { d: number; t: number; hr: number | null; alt: number | null };


/* ============================================================ */
/* SPOLOČNÉ: parsovanie raw streamov na čisté (d, t, hr, alt) body */
/* ============================================================ */

function getDistanceArray(raw: RawStreams): (number | null)[] {
  if (Array.isArray(raw.distance_m)) return raw.distance_m;
  const anyRaw = raw as any;
  if (Array.isArray(anyRaw.distance)) return anyRaw.distance;
  if (Array.isArray(anyRaw.distances_m)) return anyRaw.distances_m;
  return [];
}

function getHrArray(raw: RawStreams): (number | null)[] {
  if (Array.isArray(raw.hr)) return raw.hr;
  const anyRaw = raw as any;
  if (Array.isArray(anyRaw.heartrate_bpm)) return anyRaw.heartrate_bpm;
  return [];
}

function getAltitudeArray(raw: RawStreams): (number | null)[] {
  if (Array.isArray(raw.altitude_m)) return raw.altitude_m;
  const anyRaw = raw as any;
  if (Array.isArray(anyRaw.elevation_m)) return anyRaw.elevation_m;
  if (Array.isArray(anyRaw.altitude)) return anyRaw.altitude;
  return [];
}

export function diagnoseStream(raw: RawStreams | null | undefined): {
  ok: boolean;
  reason: "no_streams" | "no_distance" | "too_short" | "ok";
} {
  if (!raw) return { ok: false, reason: "no_streams" };
  const dist = getDistanceArray(raw);
  const time = raw.time_s ?? [];
  if (!time.length) return { ok: false, reason: "no_streams" };
  const validDistCount = dist.filter((d) => d != null && Number.isFinite(d)).length;
  if (validDistCount < 2) return { ok: false, reason: "no_distance" };
  if (validDistCount < time.length * 0.5) return { ok: false, reason: "too_short" };
  return { ok: true, reason: "ok" };
}

function toPoints(raw: RawStreams, label: string = "?"): Point[] {
  const time = raw.time_s ?? [];
  const dist = getDistanceArray(raw);
  const hr = getHrArray(raw);
  const alt = getAltitudeArray(raw);


  const points: Point[] = [];
  let lastD = -1;
  let skippedNullDist = 0;
  let skippedNonMonotonic = 0;

  for (let i = 0; i < time.length; i++) {
    const d = dist[i];
    if (d == null || !Number.isFinite(d)) {
      skippedNullDist++;
      continue;
    }
    if (d < lastD) {
      skippedNonMonotonic++;
      continue;
    }
    points.push({
      d: d / 1000,
      t: time[i],
      hr: hr[i] ?? null,
      alt: alt[i] ?? null,
    });
    lastD = d;
  }


  if (points.length < 2 && time.length > 0) {
    console.warn(
      `[routeStreamCompare] toPoints[${label}]: nepodarilo sa zostaviť body z distance_m ` +
        `(time_s má ${time.length} vzoriek, distance dalo ${points.length} platných bodov). ` +
        "Aktivita pravdepodobne nemá GPS/distance stream.",
    );
  }

  return points;
}

function findSurrounding(points: Point[], targetKm: number) {
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
}

function interpValueAtKm(points: Point[], targetKm: number, key: "hr" | "alt"): number | null {
  const { lo, hi } = findSurrounding(points, targetKm);
  const a = lo[key];
  const b = hi[key];
  if (a == null || b == null) return a ?? b ?? null;
  if (hi.d === lo.d) return a;
  const frac = (targetKm - lo.d) / (hi.d - lo.d);
  return a + (b - a) * frac;
}

function timeAtKm(points: Point[], targetKm: number): number {
  const { lo, hi } = findSurrounding(points, targetKm);
  if (hi.d === lo.d) return lo.t;
  const frac = (targetKm - lo.d) / (hi.d - lo.d);
  return lo.t + (hi.t - lo.t) * frac;
}

function paceAtKm(points: Point[], targetKm: number, stepKm: number): number | null {
  const prevKm = Math.max(0, targetKm - stepKm);
  const tPrev = timeAtKm(points, prevKm);
  const tCur = timeAtKm(points, targetKm);
  const dtSec = tCur - tPrev;
  const ddKm = targetKm - prevKm;
  const pace = dtSec > 0 && ddKm > 0 ? dtSec / ddKm : null;
  return pace != null && pace > 0 && pace < 1200 ? pace : null;
}

/* ============================================================ */
/* JEDNODUCHÉ ZAROVNANIE PODĽA VZDIALENOSTI (plochá trať / fallback) */
/* ============================================================ */

export function resampleStreamByDistance(
  raw: RawStreams,
  stepKm: number = 0.25,
  label: string = "?",
): ResampledSeries[] {
  const points = toPoints(raw, label);
  if (points.length < 2) {
    return [];
  }

  const maxKm = points[points.length - 1].d;
  const out: ResampledSeries[] = [];

  for (let km = 0; km <= maxKm; km += stepKm) {
    out.push({
      distanceKm: Math.round(km * 100) / 100,
      hr: (() => {
        const v = interpValueAtKm(points, km, "hr");
        return v != null ? Math.round(v) : null;
      })(),
      paceSecPerKm: paceAtKm(points, km, stepKm),
      elevation: (() => {
        const v = interpValueAtKm(points, km, "alt");
        return v != null ? Math.round(v) : null;
      })(),
    });
  }

  return out;
}

/* ============================================================ */
/* PREVÝŠENIE-ZAROVNANÉ POROVNANIE (kopcovité trate) */
/* ============================================================ */

function totalElevationGain(points: Point[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].alt;
    const b = points[i].alt;
    if (a == null || b == null) continue;
    const diff = b - a;
    if (diff > 0) gain += diff;
  }
  return gain;
}

function buildElevationSegments(
  points: Point[],
  minDeltaM: number = 3,
): { startIdx: number; endIdx: number; direction: "up" | "down" | "flat" }[] {
  const segments: { startIdx: number; endIdx: number; direction: "up" | "down" | "flat" }[] = [];
  if (points.length < 2) return segments;

  let segStart = 0;
  let segAltStart = points[0].alt ?? 0;
  let curDirection: "up" | "down" | "flat" = "flat";

  for (let i = 1; i < points.length; i++) {
    const alt = points[i].alt;
    if (alt == null) continue;
    const delta = alt - segAltStart;

    if (Math.abs(delta) < minDeltaM) continue;

    const newDirection: "up" | "down" | "flat" = delta > 0 ? "up" : "down";

    if (curDirection === "flat") {
      curDirection = newDirection;
      segAltStart = points[segStart].alt ?? alt;
    } else if (newDirection !== curDirection) {
      segments.push({ startIdx: segStart, endIdx: i - 1, direction: curDirection });
      segStart = i - 1;
      segAltStart = points[segStart].alt ?? alt;
      curDirection = newDirection;
    }
  }

  segments.push({ startIdx: segStart, endIdx: points.length - 1, direction: curDirection });
  return segments;
}

function matchByElevation(
  refPoints: Point[],
  refSegments: ReturnType<typeof buildElevationSegments>,
  otherPoints: Point[],
  otherSegments: ReturnType<typeof buildElevationSegments>,
  refIdx: number,
): Point | null {
  const refAlt = refPoints[refIdx].alt;
  if (refAlt == null) return null;

  const refSegIdx = refSegments.findIndex(
    (s) => refIdx >= s.startIdx && refIdx <= s.endIdx,
  );
  if (refSegIdx === -1) return null;

  const refSeg = refSegments[refSegIdx];
  const refSegPosition = refSegIdx / Math.max(1, refSegments.length - 1);

  let candidateSegs = otherSegments
    .map((s, idx) => ({ seg: s, idx }))
    .filter(({ seg }) => seg.direction === refSeg.direction);

  // Fallback: ak sa nenájde segment v ZHODNOM smere (typicky keď má trať
  // len 1 celkový segment a jeho smer sa medzi dvoma behmi líši kvôli šumu
  // v nadmorskej výške), použi VŠETKY segmenty bez ohľadu na smer - lepší
  // nepresný match ako úplne prázdna krivka.
  if (!candidateSegs.length) {

    candidateSegs = otherSegments.map((s, idx) => ({ seg: s, idx }));
  }

  if (!candidateSegs.length) return null;

  let bestSeg = candidateSegs[0];
  let bestSegDist = Infinity;
  for (const c of candidateSegs) {
    const pos = c.idx / Math.max(1, otherSegments.length - 1);
    const dist = Math.abs(pos - refSegPosition);
    if (dist < bestSegDist) {
      bestSegDist = dist;
      bestSeg = c;
    }
  }

  let bestPoint: Point | null = null;
  let bestAltDiff = Infinity;
  for (let i = bestSeg.seg.startIdx; i <= bestSeg.seg.endIdx; i++) {
    const alt = otherPoints[i]?.alt;
    if (alt == null) continue;
    const diff = Math.abs(alt - refAlt);
    if (diff < bestAltDiff) {
      bestAltDiff = diff;
      bestPoint = otherPoints[i];
    }
  }

  return bestPoint;
}

export function resampleByElevationMatch(
  referenceRaw: RawStreams,
  otherRaw: RawStreams,
  stepKm: number = 0.25,
): { reference: ResampledSeries[]; matched: ResampledSeries[] } {
  const refPoints = toPoints(referenceRaw, "ref");
  const otherPoints = toPoints(otherRaw, "other");

  if (refPoints.length < 2 || otherPoints.length < 2) {
    return { reference: [], matched: [] };
  }

  const refSegments = buildElevationSegments(refPoints);
  const otherSegments = buildElevationSegments(otherPoints);



  const maxKm = refPoints[refPoints.length - 1].d;
  const reference: ResampledSeries[] = [];
  const matched: ResampledSeries[] = [];
  let unmatchedCount = 0;

  for (let km = 0; km <= maxKm; km += stepKm) {
    const { lo } = findSurrounding(refPoints, km);
    const refIdx = refPoints.indexOf(lo);

    const refHr = interpValueAtKm(refPoints, km, "hr");
    const refAlt = interpValueAtKm(refPoints, km, "alt");
    const refPace = paceAtKm(refPoints, km, stepKm);

    reference.push({
      distanceKm: Math.round(km * 100) / 100,
      hr: refHr != null ? Math.round(refHr) : null,
      paceSecPerKm: refPace,
      elevation: refAlt != null ? Math.round(refAlt) : null,
    });

    const matchedPoint = matchByElevation(refPoints, refSegments, otherPoints, otherSegments, refIdx);

    if (matchedPoint) {
      const matchedPace = paceAtKm(otherPoints, matchedPoint.d, stepKm);
      matched.push({
        distanceKm: Math.round(km * 100) / 100,
        hr: matchedPoint.hr != null ? Math.round(matchedPoint.hr) : null,
        paceSecPerKm: matchedPace,
        elevation: matchedPoint.alt != null ? Math.round(matchedPoint.alt) : null,
      });
    } else {
      unmatchedCount++;
      matched.push({
        distanceKm: Math.round(km * 100) / 100,
        hr: null,
        paceSecPerKm: null,
        elevation: null,
      });
    }
  }


  return { reference, matched };
}

export function shouldUseElevationAlignment(raw: RawStreams): boolean {
  const points = toPoints(raw, "shouldUseElevationAlignment-check");
  if (points.length < 2) {

    return false;
  }
  const totalKm = points[points.length - 1].d;
  if (totalKm <= 0) {

    return false;
  }
  const gain = totalElevationGain(points);
  const gainPerKm = gain / totalKm;
  const result = gainPerKm > 5;

  return result;
}

/* ============================================================ */
/* ZLÚČENIE PRE CHART ============================================ */
/* ============================================================ */

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
