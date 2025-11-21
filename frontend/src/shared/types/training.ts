// frontend/src/shared/types/training_types.ts
import raw from "@/data/training_types.json";

export type TrainingTypeEntry = {
  id: string;
  sport: "run" | "ride" | "strength" | "swim" | string;
  label: string;
  description: string;
  wu_min?: number | "none";
  cd_min?: number | "none";
};

export type TrainingTypesMap = {
  [sport: string]: { [key: string]: TrainingTypeEntry };
};

type TrainingTypesFile = {
  version?: number;
  meta?: unknown;
} & TrainingTypesMap;

export const trainingTypes = raw as unknown as TrainingTypesFile;

export function findTrainingTypeById(id?: string | null) {
  if (!id) return null;
  for (const sport of Object.keys(trainingTypes)) {
    const group = (trainingTypes as TrainingTypesMap)[sport];
    if (!group) continue;
    for (const key of Object.keys(group)) {
      const entry = group[key];
      if (entry?.id === id) return entry;
    }
  }
  return null;
}