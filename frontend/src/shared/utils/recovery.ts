function avg(xs: number[]) {
  const a = xs.filter((n) => Number.isFinite(n));
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}
function pctDiff(curr: number, base: number) {
  if (!isFinite(curr) || !isFinite(base) || base === 0) return 0;
  return (curr - base) / base;
}
function minutesToHhMm(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h * 60 + min;
}
function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(1439, Math.round(total)));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
