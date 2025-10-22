// src/shared/utils/duration.ts
/** Bezpečné číslo */
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** 25s | 4m 30s | 1h 05m 09s */
export function fmtSecondsHMS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** 4m 08s | 25m | 1h 05m */
export function fmtMinutes(min: number): string {
  return fmtSecondsHMS((Number(min) || 0) * 60);
}

/** Len minúty, zaokrúhlené na celé: "123 min" */
export function fmtMinutesWhole(minutesInput: number | null | undefined): string {
  return `${Math.round(num(minutesInput))} min`;
}

/** 100 m | 950 m | 1.1 km | 12 km */
export function fmtDistance(meters: number): string {
  const m = Math.max(0, Number(meters) || 0);
  if (m < 1000) {
    // zaokrúhlenie na 100 m
    const mm = Math.round(m / 100) * 100;
    return `${mm} m`;
  }
  const km = m / 1000;
  // pri < 10 km nechaj 1 desatinné miesto, inak celé km
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}


