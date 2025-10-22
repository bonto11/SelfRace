// čas -> "5h 30m 26s" / "4m 30s" / "25s"
// bezpečne zvládne number | null | undefined | NaN
export function fmtSecondsHMS(v?: number | null): string {
  const sTot = Number(v);
  if (!Number.isFinite(sTot) || sTot < 0) return "—";

  const h = Math.floor(sTot / 3600);
  const m = Math.floor((sTot % 3600) / 60);
  const s = Math.round(sTot % 60);

  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// minúty (float) -> "5h 30m" / "4m" / "0m"
export function fmtMinutes(v?: number | null): string {
  const min = Number(v);
  if (!Number.isFinite(min) || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// minúty (float) -> celé minúty: "123 min" / "—"
export function fmtMinutesWhole(v?: number | null): string {
  const min = Number(v);
  if (!Number.isFinite(min) || min < 0) return "—";
  return `${Math.round(min)} min`;
}

// vzdialenosť v metroch -> "987 m" / "1.32 km" / "5 km"
export function fmtDistance(
  meters?: number | null,
  opts?: { kmDecimals?: number; trimZeros?: boolean }
): string {
  const kmDecimals = opts?.kmDecimals ?? 2;
  const trimZeros = opts?.trimZeros ?? true;

  const m = Number(meters);
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;

  const km = m / 1000;
  let s = km.toFixed(kmDecimals);
  if (trimZeros) s = s.replace(/(\.\d*?[1-9])0+$|\.0+$/g, "$1");
  return `${s} km`;
}