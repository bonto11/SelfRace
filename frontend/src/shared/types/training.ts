// frontend/src/shared/types/training_types.ts
import raw from "@/data/training_types.json";

/** WU/CD defaulty uložené v JSON pri konkrétnom session_type.
 *  - warmup/cooldown: číslo v min alebo "none"
 *  - hr_for_wu_cd: voliteľné HR rozmedzie použiteľné pre WU/CD
 */
export type WuCdDefaults = {
  warmup?: number | "none";
  cooldown?: number | "none";
  hr_for_wu_cd?: [number, number] | null;
};

export type TrainingTypeEntry = {
  id: string;
  sport: "run" | "ride" | "strength" | "swim" | string;
  label: string;
  description: string;
  defaults?: WuCdDefaults;
};

// skupina typov pre daný šport (run/ride/...)
export type TrainingGroup = Record<string, TrainingTypeEntry>;

// map bez meta (čisté skupiny typov)
export type TrainingTypesMap = Record<string, TrainingGroup>;

// tvar súboru z JSON (môže mať "meta")
type TrainingTypesFile = {
  meta?: { version: number; notes?: string };
  [sport: string]: unknown;
};

// načítanie a odfiltrovanie "meta"
const file = raw as unknown as TrainingTypesFile;
export const trainingTypes: TrainingTypesMap = Object.fromEntries(
  Object.entries(file).filter(
    ([k, v]) => k !== "meta" && typeof v === "object" && v !== null
  )
) as TrainingTypesMap;

// lookup podľa session_type id
export function findTrainingTypeById(
  sessionTypeId: string | null | undefined
): TrainingTypeEntry | null {
  if (!sessionTypeId) return null;
  for (const sport of Object.keys(trainingTypes)) {
    const group = trainingTypes[sport];
    for (const key of Object.keys(group)) {
      const entry = group[key];
      if (entry.id === sessionTypeId) return entry;
    }
  }
  return null;
}

/** Vyťahne WU/CD defaulty pre daný session_type z JSONu.
 *  Vráti vždy konzistentný objekt (null ak nič).
 */
export function getWuCdDefaults(
  sessionTypeId: string | null | undefined
): { wuMin: number | null; cdMin: number | null; hrForWuCd: [number, number] | null } {
  const entry = findTrainingTypeById(sessionTypeId);
  if (!entry || !entry.defaults) {
    return { wuMin: null, cdMin: null, hrForWuCd: null };
    }
  const d = entry.defaults;

  const toMin = (v: unknown): number | null => {
    if (v === "none" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const wuMin = toMin((d as any).warmup);
  const cdMin = toMin((d as any).cooldown);

  let hrForWuCd: [number, number] | null = null;
  if (Array.isArray(d.hr_for_wu_cd) && d.hr_for_wu_cd.length === 2) {
    const lo = Number(d.hr_for_wu_cd[0]);
    const hi = Number(d.hr_for_wu_cd[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      hrForWuCd = [Math.round(lo), Math.round(hi)];
    }
  }

  return { wuMin, cdMin, hrForWuCd };
}