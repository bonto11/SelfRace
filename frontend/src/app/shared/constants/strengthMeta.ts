// src/app/shared/constants/strengthMeta.ts
// 🌟 NOVÉ: generované z Configs/strength_catalog.py (measure + load_mode).
// Editor zápisu podľa toho vie, či má pri cviku pýtať opakovania, sekundy
// alebo metre, a či sú kilá povinné (external) alebo voliteľné prídavné
// závažie (bodyweight_plus, prázdne = čistá vlastná váha).
// Pri zmene katalógu na BE treba tento súbor pregenerovať.

export type ExerciseMeasure = "reps" | "time" | "distance";
export type ExerciseLoadMode = "external" | "bodyweight_plus";

export type ExerciseMeta = {
  measure: ExerciseMeasure;
  load_mode: ExerciseLoadMode;
};

export const STRENGTH_META: Record<string, ExerciseMeta> = {
  plank: { measure: "time", load_mode: "bodyweight_plus" },
  side_plank: { measure: "time", load_mode: "bodyweight_plus" },
  abwheel_rollout: { measure: "reps", load_mode: "bodyweight_plus" },
  hanging_knee_raise: { measure: "reps", load_mode: "bodyweight_plus" },
  cable_chop: { measure: "reps", load_mode: "external" },
  bird_dog: { measure: "reps", load_mode: "bodyweight_plus" },
  dead_bug: { measure: "reps", load_mode: "bodyweight_plus" },
  russian_twist: { measure: "reps", load_mode: "bodyweight_plus" },
  mountain_climber: { measure: "reps", load_mode: "bodyweight_plus" },
  hollow_body_hold: { measure: "time", load_mode: "bodyweight_plus" },
  medicine_ball_rotational_throw: { measure: "reps", load_mode: "external" },
  bodyweight_squat: { measure: "reps", load_mode: "bodyweight_plus" },
  barbell_back_squat: { measure: "reps", load_mode: "external" },
  front_squat_barbell: { measure: "reps", load_mode: "external" },
  leg_press_machine: { measure: "reps", load_mode: "external" },
  split_squat: { measure: "reps", load_mode: "bodyweight_plus" },
  goblet_squat: { measure: "reps", load_mode: "external" },
  box_stepup: { measure: "reps", load_mode: "bodyweight_plus" },
  bulgarian_split_squat: { measure: "reps", load_mode: "bodyweight_plus" },
  walking_lunge: { measure: "reps", load_mode: "bodyweight_plus" },
  hack_squat_machine: { measure: "reps", load_mode: "external" },
  leg_extension_machine: { measure: "reps", load_mode: "external" },
  glute_bridge_bodyweight: { measure: "reps", load_mode: "bodyweight_plus" },
  romanian_deadlift_barbell: { measure: "reps", load_mode: "external" },
  romanian_deadlift_dumbbell: { measure: "reps", load_mode: "external" },
  single_leg_deadlift_band: { measure: "reps", load_mode: "bodyweight_plus" },
  hamstring_curl_machine: { measure: "reps", load_mode: "external" },
  hip_thrust_barbell: { measure: "reps", load_mode: "external" },
  kettlebell_swing: { measure: "reps", load_mode: "external" },
  conventional_deadlift: { measure: "reps", load_mode: "external" },
  good_morning_barbell: { measure: "reps", load_mode: "external" },
  back_extension: { measure: "reps", load_mode: "bodyweight_plus" },
  standing_calf_raise: { measure: "reps", load_mode: "bodyweight_plus" },
  seated_calf_raise: { measure: "reps", load_mode: "external" },
  single_leg_calf_raise: { measure: "reps", load_mode: "bodyweight_plus" },
  jump_rope: { measure: "time", load_mode: "bodyweight_plus" },
  tibialis_raise: { measure: "reps", load_mode: "bodyweight_plus" },
  bodyweight_row: { measure: "reps", load_mode: "bodyweight_plus" },
  trx_row: { measure: "reps", load_mode: "bodyweight_plus" },
  lat_pulldown_machine: { measure: "reps", load_mode: "external" },
  pullup_assisted: { measure: "reps", load_mode: "bodyweight_plus" },
  pullup_strict: { measure: "reps", load_mode: "bodyweight_plus" },
  dumbbell_row: { measure: "reps", load_mode: "external" },
  barbell_row: { measure: "reps", load_mode: "external" },
  seated_cable_row: { measure: "reps", load_mode: "external" },
  face_pull: { measure: "reps", load_mode: "external" },
  chin_up: { measure: "reps", load_mode: "bodyweight_plus" },
  band_pull_apart: { measure: "reps", load_mode: "bodyweight_plus" },
  cable_external_rotation: { measure: "reps", load_mode: "external" },
  pushup: { measure: "reps", load_mode: "bodyweight_plus" },
  bench_press_barbell: { measure: "reps", load_mode: "external" },
  incline_db_press: { measure: "reps", load_mode: "external" },
  shoulder_press_dumbbell: { measure: "reps", load_mode: "external" },
  dip_assisted: { measure: "reps", load_mode: "bodyweight_plus" },
  dip_strict: { measure: "reps", load_mode: "bodyweight_plus" },
  overhead_press_barbell: { measure: "reps", load_mode: "external" },
  push_press: { measure: "reps", load_mode: "external" },
  pec_deck_fly: { measure: "reps", load_mode: "external" },
  triceps_pushdown: { measure: "reps", load_mode: "external" },
  scapular_pushup: { measure: "reps", load_mode: "bodyweight_plus" },
  farmers_carry: { measure: "time", load_mode: "external" },
  sandbag_carry: { measure: "time", load_mode: "external" },
  bucket_carry: { measure: "time", load_mode: "external" },
  sled_push: { measure: "distance", load_mode: "external" },
  sled_pull: { measure: "distance", load_mode: "external" },
  ski_erg: { measure: "time", load_mode: "external" },
  rowing_erg: { measure: "time", load_mode: "external" },
  assault_bike: { measure: "time", load_mode: "external" },
  wall_ball: { measure: "reps", load_mode: "external" },
  thruster: { measure: "reps", load_mode: "external" },
  sandbag_lunge: { measure: "reps", load_mode: "external" },
  box_jump: { measure: "reps", load_mode: "bodyweight_plus" },
  broad_jump: { measure: "reps", load_mode: "bodyweight_plus" },
  burpee: { measure: "reps", load_mode: "bodyweight_plus" },
  devils_press: { measure: "reps", load_mode: "external" },
  turkish_getup: { measure: "reps", load_mode: "external" },
  kettlebell_clean_and_press: { measure: "reps", load_mode: "external" },
  medicine_ball_slam: { measure: "reps", load_mode: "external" },
  rope_climb: { measure: "reps", load_mode: "bodyweight_plus" },
  dead_hang: { measure: "time", load_mode: "bodyweight_plus" },
  monkey_bar_traverse: { measure: "time", load_mode: "bodyweight_plus" },
};

/** Fallback pre neznáme id (napr. starší log): opakovania + povinné kg. */
export const DEFAULT_EXERCISE_META: ExerciseMeta = {
  measure: "reps",
  load_mode: "external",
};

export function getExerciseMeta(exerciseId: string): ExerciseMeta {
  return STRENGTH_META[exerciseId] ?? DEFAULT_EXERCISE_META;
}

/** Jednotka pre pole "opakovaní" v zápise: 12 / 45s / 30m */
export function repsUnitLabel(measure: ExerciseMeasure): "reps" | "s" | "m" {
  if (measure === "time") return "s";
  if (measure === "distance") return "m";
  return "reps";
}