
// vzdialenosť v metroch -> "987 m" / "1.32 km" / "5 km"
export function formatDistance(
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