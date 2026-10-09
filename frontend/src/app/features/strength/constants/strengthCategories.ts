// src/app/features/strength/constants/strengthCategories.ts
// Kategórie cvikov pre filter vo výbere (popri svalových partiách).
// PREČO zvlášť od strengthMuscles: plyometria a izometria nie sú partie -
// do objemu sa nerátajú, len pomáhajú bežcovi rýchlo nájsť odrazy a výdrže.

export type ExerciseCategory = "plyo" | "iso";

export const EXERCISE_CATEGORIES: ExerciseCategory[] = ["plyo", "iso"];

const CATEGORY_IDS: Record<ExerciseCategory, string[]> = {
  plyo: [
    "box_jump",
    "broad_jump",
    "jump_rope",
    "jump_squat",
    "split_jump",
    "single_leg_hop",
    "lateral_bound",
    "bounding",
    "a_skip",
    "drop_jump",
    "tuck_jump",
  ],
  iso: [
    "plank",
    "side_plank",
    "hollow_body_hold",
    "copenhagen_plank",
    "wall_sit",
    "isometric_split_squat_hold",
    "isometric_calf_hold",
    "spanish_squat",
    "single_leg_bridge_hold",
    "isometric_hamstring_bridge",
    "isometric_tibialis_hold",
  ],
};

export function inCategory(exerciseId: string, category: ExerciseCategory): boolean {
  return CATEGORY_IDS[category].includes(exerciseId);
}
