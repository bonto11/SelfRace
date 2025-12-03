// src/features/coach/utils/thresholds.ts
/**
 * Počiatočný draft thresholdu pre CoachPrefs:
 *  - vyberie najnovší riadok z latestRows (prefer running + LT2)
 *  - prefs.thresholds NEPOUŽÍVAME (zabránime tým ťahaniu starých hodnôt)
 */
export function pickInitialThresholdDraft(
  _prefs: any,
  latestRows: any[] | null
): any | undefined {
  const rows = Array.isArray(latestRows) ? latestRows : [];

  if (!rows.length) return undefined;

  // preferuj running + LT2
  const primary =
    rows.find(
      (r) =>
        String(r.threshold_type).toUpperCase() === "LT2" &&
        String(r.sport ?? "").toLowerCase() === "running"
    ) ??
    rows[0]; // fallback: prvý z listu

  return primary || undefined;
}