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

function toPoints(raw: RawStreams): Point[] {
  const time = raw.time_s ?? [];
  const dist = raw.distance_m ?? [];
  const hr = raw.hr ?? [];
  const alt = raw.altitude_m ?? [];

  const points: Point[] = [];
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
): ResampledSeries[] {
  const points = toPoints(raw);
  if (points.length < 2) return [];

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

/**
 * Rozdelí trať na monotónne segmenty (stúpanie / klesanie / rovina),
 * s minimálnym prahom zmeny výšky, aby drobný GPS šum nevytváral
 * desiatky mikro-segmentov.
 */
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

/**
 * Pre daný referenčný bod (index v referenčnej trati, s jeho elevation a
 * "fázou" - poradím segmentu a smerom) nájde v druhej trati bod s najbližšou
 * zhodou výšky V ROVNAKOM TYPE SEGMENTU (aby sa stúpanie na 3. km neplietlo
 * so zostupom na 8. km pri rovnakej nadmorskej výške).
 */
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

  const candidateSegs = otherSegments
    .map((s, idx) => ({ seg: s, idx }))
    .filter(({ seg }) => seg.direction === refSeg.direction);

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

/**
 * Elevation-zarovnané prevzorkovanie: os X ostáva vzdialenosť REFERENČNEJ
 * trate (tá s viac dátami / novšia), ale hodnoty (tempo/HR) druhej trate
 * sa priraďujú podľa zhody nadmorskej výšky v zodpovedajúcom teréne, nie
 * podľa rovnakej vzdialenosti od štartu.
 */
export function resampleByElevationMatch(
  referenceRaw: RawStreams,
  otherRaw: RawStreams,
  stepKm: number = 0.25,
): { reference: ResampledSeries[]; matched: ResampledSeries[] } {
  const refPoints = toPoints(referenceRaw);
  const otherPoints = toPoints(otherRaw);

  if (refPoints.length < 2 || otherPoints.length < 2) {
    return { reference: [], matched: [] };
  }

  const refSegments = buildElevationSegments(refPoints);
  const otherSegments = buildElevationSegments(otherPoints);

  const maxKm = refPoints[refPoints.length - 1].d;
  const reference: ResampledSeries[]
