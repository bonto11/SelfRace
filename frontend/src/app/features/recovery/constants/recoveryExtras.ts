// Regeneračné praktiky v rannom zápise („Včera“) – zrkadlo BE
// Services/AI/utils/recovery_extras.py (RECOVERY_EXTRAS). Platia pre deň
// pred zápisom, rovnako ako alkohol a neskorá káva.
export const RECOVERY_EXTRAS = ["sauna", "cold", "massage", "mobility", "nap", "physio", "breathing"] as const;

export type RecoveryExtra = (typeof RECOVERY_EXTRAS)[number];

export const RECOVERY_EXTRA_ICONS: Record<RecoveryExtra, string> = {
  sauna: "🧖",
  cold: "🧊",
  massage: "💆",
  mobility: "🤸",
  nap: "😴",
  physio: "🩺",
  breathing: "🌬️",
};

export function normalizeRecoveryExtras(v: unknown): RecoveryExtra[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(v.map(String));
  return RECOVERY_EXTRAS.filter((k) => set.has(k));
}
