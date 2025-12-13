import rawFile from "@/data/training_types.json";

/**
 * Jeden session_type z katalógu.
 * Pozn.: wu_min / cd_min sú minúty pre default warmup/cooldown (alebo null = žiadny).
 */
export type TrainingTypeEntry = {
  id: string;
  sport: "run" | "ride" | "strength" | "swim" | string;
  label: string;
  description: string;
  wu_min?: number | null;
  cd_min?: number | null;
  notes?: string;
};

/** Mapovanie: šport -> (session_type_key -> entry) */
export type TrainingTypesMap = {
  [sport: string]: {
    [key: string]: TrainingTypeEntry;
  };
};

// ---- bezpečný parse JSONu: ignorujeme meta/iné kľúče na top-levele ----
type RawJson = Record<string, any>;
const raw = rawFile as RawJson;

function pickGroup(r: RawJson, sport: "run" | "ride" | "strength" | "swim") {
  const grp = r?.[sport];
  return grp && typeof grp === "object"
    ? (grp as Record<string, TrainingTypeEntry>)
    : {};
}

/** Používaj toto – je to čisté mapovanie len štyroch športov. */
export const trainingTypes: TrainingTypesMap = {
  run: pickGroup(raw, "run"),
  ride: pickGroup(raw, "ride"),
  strength: pickGroup(raw, "strength"),
  swim: pickGroup(raw, "swim"),
};

// ---- helpery ----

/** Lookup podľa session_type id (napr. "run_easy"). */
export function findTrainingTypeById(
  sessionTypeId: string | null | undefined
): TrainingTypeEntry | null {
  if (!sessionTypeId) return null;
  for (const sport of Object.keys(trainingTypes)) {
    const group = trainingTypes[sport];
    for (const key of Object.keys(group)) {
      const entry = group[key];
      if (entry?.id === sessionTypeId) return entry;
    }
  }
  return null;
}

/**
 * Vytiahne default WU/CD minúty z katalógu pre daný session_type.
 * Ak nie sú definované, vráti null.
 */
export function getWuCdDefaults(
  sessionTypeId: string | null | undefined
): { warmup: number | null; cooldown: number | null } {
  const entry = findTrainingTypeById(sessionTypeId);
  const warmup =
    typeof entry?.wu_min === "number" ? (entry!.wu_min as number) : null;
  const cooldown =
    typeof entry?.cd_min === "number" ? (entry!.cd_min as number) : null;
  return { warmup, cooldown };
}