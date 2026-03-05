// src/app/shared/constants/strengthCatalog.ts

export type ExerciseLangMap = {
  en: string;
  sk: string;
};

// Kľúč je exercise_id, hodnota je preklad. 
export const STRENGTH_CATALOG_FE: Record<string, ExerciseLangMap> = {
  // Core
  "plank": { en: "Plank", sk: "Plank" },
  "side_plank": { en: "Side Plank", sk: "Bočný plank" },
  "abwheel_rollout": { en: "Ab Wheel Rollout", sk: "Ab wheel rollout" },
  "hanging_knee_raise": { en: "Hanging Knee Raise", sk: "Zdvíhanie kolien vo vise" },
  "cable_chop": { en: "Cable Woodchop", sk: "Sťahovanie kladky zboku" },
  "bird_dog": { en: "Bird-Dog", sk: "Zdvihy na štyroch (Bird-dog)" },
  "dead_bug": { en: "Dead Bug", sk: "Mŕtvy chrobák (Dead bug)" },
  "russian_twist": { en: "Russian Twist", sk: "Ruský twist" },
  "mountain_climber": { en: "Mountain Climber", sk: "Horolezec (Mountain climber)" },
  "hollow_body_hold": { en: "Hollow Body Hold", sk: "Kolíska (Hollow hold)" },

  // Lower Quad
  "bodyweight_squat": { en: "Bodyweight Squat", sk: "Drep s vlastnou váhou" },
  "barbell_back_squat": { en: "Barbell Back Squat", sk: "Drep s veľkou činkou" },
  "leg_press_machine": { en: "Leg Press", sk: "Leg press stroj" },
  "split_squat": { en: "Split Squat", sk: "Rozdelený drep (Split squat)" },
  "goblet_squat": { en: "Goblet Squat", sk: "Goblet drep" },
  "box_stepup": { en: "Box Step-up", sk: "Výstupy na debnu" },
  "bulgarian_split_squat": { en: "Bulgarian Split Squat", sk: "Bulharský drep" },
  "walking_lunge": { en: "Walking Lunge", sk: "Kráčavé výpady" },
  "hack_squat_machine": { en: "Hack Squat", sk: "Hack drep stroj" },
  "leg_extension_machine": { en: "Leg Extension", sk: "Predkopávanie stroj" },

  // Lower Posterior
  "glute_bridge_bodyweight": { en: "Glute Bridge", sk: "Glute bridge (Dvíhanie panvy)" },
  "romanian_deadlift_barbell": { en: "Barbell RDL", sk: "Rumunský mŕtvy ťah (Činka)" },
  "romanian_deadlift_dumbbell": { en: "Dumbbell RDL", sk: "Rumunský mŕtvy ťah (Jednoručky)" },
  "single_leg_deadlift_band": { en: "Single Leg Deadlift", sk: "Mŕtvy ťah na 1 nohe" },
  "hamstring_curl_machine": { en: "Hamstring Curl", sk: "Zakopávanie stroj" },
  "hip_thrust_barbell": { en: "Barbell Hip Thrust", sk: "Hip thrust s činkou" },
  "kettlebell_swing": { en: "Kettlebell Swing", sk: "Kettlebell swing" },
  "conventional_deadlift": { en: "Conventional Deadlift", sk: "Klasický mŕtvy ťah" },
  "good_morning_barbell": { en: "Barbell Good Morning", sk: "Good morning s činkou" },
  "back_extension": { en: "Back Extension", sk: "Extenzie chrbta (Hyperextenzie)" },

  // Lower Calves
  "standing_calf_raise": { en: "Standing Calf Raise", sk: "Výpony v stoji" },
  "seated_calf_raise": { en: "Seated Calf Raise", sk: "Výpony v sede" },
  "single_leg_calf_raise": { en: "Single Leg Calf Raise", sk: "Výpony na jednej nohe" },
  "jump_rope": { en: "Jump Rope / Pogo Jumps", sk: "Švihadlo / Pogo výskoky" },
  "tibialis_raise": { en: "Tibialis Raise", sk: "Zdvíhanie špičiek (Tibialis)" },

  // Upper Pull
  "bodyweight_row": { en: "Inverted Row", sk: "Príťahy na hrazde (vodorovne)" },
  "trx_row": { en: "TRX Row", sk: "TRX príťahy" },
  "lat_pulldown_machine": { en: "Lat Pulldown", sk: "Sťahovanie kladky na chrbát" },
  "pullup_assisted": { en: "Assisted Pull-up", sk: "Zhyby s dopomocou" },
  "pullup_strict": { en: "Strict Pull-up", sk: "Zhyby (Príťahy nadhmatom)" },
  "dumbbell_row": { en: "Single Arm Dumbbell Row", sk: "Príťahy jednoručky v predklone" },
  "barbell_row": { en: "Barbell Bent-Over Row", sk: "Príťahy s veľkou činkou v predklone" },
  "seated_cable_row": { en: "Seated Cable Row", sk: "Príťahy na spodnej kladke v sede" },
  "face_pull": { en: "Face Pull", sk: "Face pull (Sťahovanie kladky k tvári)" },
  "chin_up": { en: "Chin-up", sk: "Zhyby podhmatom" },

  // Upper Push
  "pushup": { en: "Push-up", sk: "Kľuk" },
  "bench_press_barbell": { en: "Barbell Bench Press", sk: "Tlak na lavičke (Bench press)" },
  "incline_db_press": { en: "Incline Dumbbell Press", sk: "Tlaky jednoručiek na šikmej lavičke" },
  "shoulder_press_dumbbell": { en: "Dumbbell Shoulder Press", sk: "Tlak jednoručkami nad hlavu" },
  "dip_assisted": { en: "Assisted Dips", sk: "Kľuky na bradlách s dopomocou" },
  "dip_strict": { en: "Strict Dips", sk: "Kľuky na bradlách (Dipy)" },
  "overhead_press_barbell": { en: "Overhead Press", sk: "Tlak s veľkou činkou nad hlavu" },
  "push_press": { en: "Push Press", sk: "Push press (Tlak s dopomocou nôh)" },
  "pec_deck_fly": { en: "Pec Deck Fly", sk: "Peck Deck (Rozpažovanie stroj)" },
  "triceps_pushdown": { en: "Cable Triceps Pushdown", sk: "Sťahovanie kladky na triceps" },
};