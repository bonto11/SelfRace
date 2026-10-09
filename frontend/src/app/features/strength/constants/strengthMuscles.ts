// src/app/features/strength/constants/strengthMuscles.ts
// 🌟 NOVÉ: generované z Configs/strength_muscles.py.
// Slúži na filtrovanie cvikov podľa partie vo výbere cviku. Pri zmene
// katalógu na BE treba tento súbor pregenerovať.

export type MuscleKey =
  | "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "core" | "glutes" | "quads" | "hamstrings" | "calves";

/** Poradie pre UI: veľké partie hore, malé dole. */
export const MUSCLE_GROUPS: MuscleKey[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "core", "glutes", "quads", "hamstrings", "calves",
];

/** 1.0 = hlavná partia, 0.5 = pomocná (zlomkový objem). */
export const EXERCISE_MUSCLES: Record<string, Partial<Record<MuscleKey, number>>> = {
  plank: { core: 1 },
  side_plank: { core: 1 },
  abwheel_rollout: { core: 1, shoulders: 0.5 },
  hanging_knee_raise: { core: 1, forearms: 0.5 },
  cable_chop: { core: 1, shoulders: 0.5 },
  bird_dog: { core: 1, glutes: 0.5 },
  dead_bug: { core: 1 },
  russian_twist: { core: 1 },
  mountain_climber: { core: 1, shoulders: 0.5 },
  hollow_body_hold: { core: 1 },
  medicine_ball_rotational_throw: { core: 1, shoulders: 0.5 },

  bodyweight_squat: { quads: 1, glutes: 0.5 },
  barbell_back_squat: { quads: 1, glutes: 1, core: 0.5 },
  front_squat_barbell: { quads: 1, glutes: 0.5, core: 0.5 },
  leg_press_machine: { quads: 1, glutes: 0.5 },
  split_squat: { quads: 1, glutes: 1 },
  goblet_squat: { quads: 1, glutes: 0.5, core: 0.5 },
  box_stepup: { quads: 1, glutes: 1 },
  bulgarian_split_squat: { quads: 1, glutes: 1 },
  walking_lunge: { quads: 1, glutes: 1 },
  hack_squat_machine: { quads: 1, glutes: 0.5 },
  leg_extension_machine: { quads: 1 },

  glute_bridge_bodyweight: { glutes: 1, hamstrings: 0.5 },
  romanian_deadlift_barbell: { hamstrings: 1, glutes: 1, back: 0.5 },
  romanian_deadlift_dumbbell: { hamstrings: 1, glutes: 1, back: 0.5 },
  single_leg_deadlift_band: { hamstrings: 1, glutes: 1, core: 0.5 },
  hamstring_curl_machine: { hamstrings: 1 },
  hip_thrust_barbell: { glutes: 1, hamstrings: 0.5 },
  kettlebell_swing: { glutes: 1, hamstrings: 1, back: 0.5 },
  conventional_deadlift: { hamstrings: 1, glutes: 1, back: 1, forearms: 0.5 },
  good_morning_barbell: { hamstrings: 1, glutes: 0.5, back: 0.5 },
  back_extension: { back: 1, glutes: 0.5, hamstrings: 0.5 },

  standing_calf_raise: { calves: 1 },
  seated_calf_raise: { calves: 1 },
  single_leg_calf_raise: { calves: 1 },
  jump_rope: { calves: 1 },
  tibialis_raise: { calves: 0.5 },

  bodyweight_row: { back: 1, biceps: 0.5 },
  trx_row: { back: 1, biceps: 0.5 },
  lat_pulldown_machine: { back: 1, biceps: 0.5 },
  pullup_assisted: { back: 1, biceps: 0.5 },
  pullup_strict: { back: 1, biceps: 0.5, forearms: 0.5 },
  dumbbell_row: { back: 1, biceps: 0.5 },
  barbell_row: { back: 1, biceps: 0.5 },
  seated_cable_row: { back: 1, biceps: 0.5 },
  face_pull: { shoulders: 1, back: 0.5 },
  chin_up: { back: 1, biceps: 1 },
  band_pull_apart: { shoulders: 1, back: 0.5 },
  cable_external_rotation: { shoulders: 1 },

  pushup: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  bench_press_barbell: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  incline_db_press: { chest: 1, shoulders: 0.5, triceps: 0.5 },
  shoulder_press_dumbbell: { shoulders: 1, triceps: 0.5 },
  dip_assisted: { chest: 1, triceps: 1, shoulders: 0.5 },
  dip_strict: { chest: 1, triceps: 1, shoulders: 0.5 },
  overhead_press_barbell: { shoulders: 1, triceps: 0.5, core: 0.5 },
  push_press: { shoulders: 1, triceps: 0.5, quads: 0.5 },
  pec_deck_fly: { chest: 1 },
  triceps_pushdown: { triceps: 1 },
  scapular_pushup: { shoulders: 1 },

  farmers_carry: { forearms: 1, core: 1, back: 0.5 },
  sandbag_carry: { core: 1, back: 1, forearms: 0.5 },
  bucket_carry: { forearms: 1, core: 1, back: 0.5 },
  sled_push: { quads: 1, glutes: 1, calves: 0.5 },
  sled_pull: { back: 1, quads: 0.5, biceps: 0.5 },
  ski_erg: { back: 1, core: 1, triceps: 0.5 },
  rowing_erg: { back: 1, quads: 0.5, biceps: 0.5 },
  assault_bike: { quads: 0.5, shoulders: 0.5 },
  wall_ball: { quads: 1, shoulders: 1, glutes: 0.5 },
  thruster: { quads: 1, shoulders: 1, glutes: 0.5, triceps: 0.5 },
  sandbag_lunge: { quads: 1, glutes: 1, core: 0.5 },
  box_jump: { quads: 1, glutes: 0.5, calves: 0.5 },
  broad_jump: { quads: 1, glutes: 1, calves: 0.5 },
  burpee: { chest: 0.5, quads: 0.5, core: 0.5 },
  devils_press: { shoulders: 1, hamstrings: 0.5, quads: 0.5, core: 0.5 },
  turkish_getup: { shoulders: 1, core: 1 },
  kettlebell_clean_and_press: { shoulders: 1, glutes: 0.5, hamstrings: 0.5, core: 0.5 },
  medicine_ball_slam: { core: 1, back: 0.5, shoulders: 0.5 },
  rope_climb: { back: 1, biceps: 1, forearms: 1 },
  dead_hang: { forearms: 1 },
  monkey_bar_traverse: { forearms: 1, back: 0.5, biceps: 0.5 },
  dumbbell_biceps_curl: { biceps: 1, forearms: 0.5 },
  barbell_biceps_curl: { biceps: 1, forearms: 0.5 },
  hammer_curl: { biceps: 1, forearms: 0.5 },
  cable_biceps_curl: { biceps: 1, forearms: 0.5 },
  overhead_triceps_extension: { triceps: 1 },
  skull_crusher: { triceps: 1 },
  close_grip_bench_press: { triceps: 1, chest: 0.5, shoulders: 0.5 },
  bench_dip: { triceps: 1, chest: 0.5 },
  lateral_raise: { shoulders: 1 },
  rear_delt_fly: { shoulders: 1, back: 0.5 },
  dumbbell_bench_press: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  chest_press_machine: { chest: 1, triceps: 0.5, shoulders: 0.5 },
  cable_fly: { chest: 1, shoulders: 0.5 },
  trap_bar_deadlift: { glutes: 1, quads: 0.5, hamstrings: 0.5, back: 0.5, forearms: 0.5 },
  machine_row: { back: 1, biceps: 0.5 },
  reverse_lunge: { quads: 1, glutes: 1 },
  lateral_lunge: { quads: 1, glutes: 0.5 },
  single_leg_glute_bridge: { glutes: 1, hamstrings: 0.5 },
  nordic_hamstring_curl: { hamstrings: 1 },
  hip_abduction_machine: { glutes: 1 },
  lateral_band_walk: { glutes: 1 },
  pallof_press: { core: 1 },
  lying_leg_raise: { core: 1 },
  copenhagen_plank: { core: 1, glutes: 0.5 },
  crunch: { core: 1 },
  leg_press_calf_raise: { calves: 1 },
  hip_adduction_machine: { quads: 0.5, glutes: 0.5 },
  lying_leg_curl_machine: { hamstrings: 1 },
  dumbbell_fly: { chest: 1, shoulders: 0.5 },
  triceps_rope_pushdown: { triceps: 1 },
};

export function getMuscles(exerciseId: string): Partial<Record<MuscleKey, number>> {
  return EXERCISE_MUSCLES[exerciseId] ?? {};
}

/** Zaťažuje cvik danú partiu? primaryOnly = len ako hlavný hýbateľ. */
export function worksMuscle(
  exerciseId: string,
  muscle: MuscleKey,
  primaryOnly = false,
): boolean {
  const w = getMuscles(exerciseId)[muscle];
  if (w == null) return false;
  return primaryOnly ? w >= 1 : true;
}

/** Hlavné partie cviku - na štítok pri názve. */
export function primaryMuscles(exerciseId: string): MuscleKey[] {
  return Object.entries(getMuscles(exerciseId))
    .filter(([, w]) => (w ?? 0) >= 1)
    .map(([m]) => m as MuscleKey);
}