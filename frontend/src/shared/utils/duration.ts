// src/shared/utils/duration.ts
/** Bezpečné číslo */
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**  → "5h 30m 26s" | "4m 30s" | "25s" | "0s" */
export function fmtHMS(secondsInput: number | null | undefined): string {
  const sec = Math.max(0, Math.round(num(secondsInput)));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** minúty (float) → "Xh Ym Zs" / "Xm Ys" / "Xs" */
export function fmtFromMinutes(minutesInput: number | null | undefined): string {
  const seconds = Math.round(num(minutesInput) * 60);
  return fmtHMS(seconds);
}

/** Len minúty, zaokrúhlené na celé: "123 min" */
export function fmtMinutesWhole(minutesInput: number | null | undefined): string {
  return `${Math.round(num(minutesInput))} min`;
}