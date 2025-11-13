//frontend/src/shared/types/training_types
import raw from "@/data/training_types.json";

export type TrainingTypeEntry = {
  id: string;
  sport: "run" | "ride" | "strength" | "swim" | string;
  label: string;
  description: string;
};

export type TrainingTypesMap = {
  [sport: string]: {
    [key: string]: TrainingTypeEntry;
  };
};

export const trainingTypes = raw as TrainingTypesMap;

// malá helper funkcia – lookup podľa session_type id
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
