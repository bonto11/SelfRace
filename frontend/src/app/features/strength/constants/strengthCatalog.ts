// src/app/shared/constants/strengthCatalog.ts

export type ExerciseLangMap = {
  en: string;
  sk: string;
};

// Kľúč je exercise_id, hodnota je preklad.
// Poradie a rozdelenie do sekcií kopíruje Configs/strength_catalog.py (BE),
// aby sa dal pri pridávaní nových cvikov jednoducho porovnať riadok po riadku.
export const STRENGTH_CATALOG_FE: Record<string, ExerciseLangMap> = {
  // ================= CORE =================
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
  "medicine_ball_rotational_throw": { en: "Rotational Med Ball Throw", sk: "Rotačný hod medicinbalom" },

  // ================= LOWER BODY (QUADS) =================
  "bodyweight_squat": { en: "Bodyweight Squat", sk: "Drep s vlastnou váhou" },
  "barbell_back_squat": { en: "Barbell Back Squat", sk: "Drep s veľkou činkou" },
  "front_squat_barbell": { en: "Barbell Front Squat", sk: "Predný drep s činkou (Front squat)" },
  "leg_press_machine": { en: "Leg Press", sk: "Leg press stroj" },
  "split_squat": { en: "Split Squat", sk: "Rozdelený drep (Split squat)" },
  "goblet_squat": { en: "Goblet Squat", sk: "Goblet drep" },
  "box_stepup": { en: "Box Step-up", sk: "Výstupy na debnu" },
  "bulgarian_split_squat": { en: "Bulgarian Split Squat", sk: "Bulharský drep" },
  "walking_lunge": { en: "Walking Lunge", sk: "Kráčavé výpady" },
  "hack_squat_machine": { en: "Hack Squat", sk: "Hack drep stroj" },
  "leg_extension_machine": { en: "Leg Extension", sk: "Predkopávanie stroj" },

  // ================= LOWER BODY (POSTERIOR) =================
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

  // ================= CALVES & ANKLES =================
  "standing_calf_raise": { en: "Standing Calf Raise", sk: "Výpony v stoji" },
  "seated_calf_raise": { en: "Seated Calf Raise", sk: "Výpony v sede" },
  "single_leg_calf_raise": { en: "Single Leg Calf Raise", sk: "Výpony na jednej nohe" },
  "jump_rope": { en: "Jump Rope / Pogo Jumps", sk: "Švihadlo / Pogo výskoky" },
  "tibialis_raise": { en: "Tibialis Raise", sk: "Zdvíhanie špičiek (Tibialis)" },

  // ================= UPPER PULL =================
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
  "band_pull_apart": { en: "Band Pull-Apart", sk: "Roztiahnutie gumy (Band pull-apart)" },
  "cable_external_rotation": { en: "Cable External Rotation (Rotator Cuff)", sk: "Vonkajšia rotácia na kladke" },

  // ================= UPPER PUSH =================
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
  "scapular_pushup": { en: "Scapular Push-up (Shoulder Health)", sk: "Lopatkové kľuky (Scapular push-up)" },

  // ================= FUNCTIONAL / HYROX / OCR =================
  "farmers_carry": { en: "Farmer's Carry", sk: "Farmer's carry (Nosenie záťaže)" },
  "sandbag_carry": { en: "Sandbag Carry", sk: "Nosenie vreca s pieskom" },
  "bucket_carry": { en: "Bucket Carry", sk: "Nosenie vedra" },
  "sled_push": { en: "Sled Push", sk: "Tlačenie sane (Sled push)" },
  "sled_pull": { en: "Sled Pull", sk: "Ťahanie sane (Sled pull)" },
  "ski_erg": { en: "Ski Erg", sk: "SkiErg trenažér" },
  "rowing_erg": { en: "Rowing Machine (Erg)", sk: "Veslovací trenažér (Rowing erg)" },
  "assault_bike": { en: "Assault Bike / Echo Bike", sk: "Assault bike / Echo bike" },
  "wall_ball": { en: "Wall Ball Shot", sk: "Wall ball (Hod loptou na stenu)" },
  "thruster": { en: "Thruster (Squat to Press)", sk: "Thruster (Drep s tlakom nad hlavu)" },
  "sandbag_lunge": { en: "Sandbag Walking Lunge", sk: "Výpady s vrecom piesku" },
  "box_jump": { en: "Box Jump", sk: "Skok na debnu (Box jump)" },
  "broad_jump": { en: "Standing Broad Jump", sk: "Skok do diaľky z miesta" },
  "burpee": { en: "Burpee", sk: "Burpee" },
  "devils_press": { en: "Devil's Press", sk: "Devil's press" },
  "turkish_getup": { en: "Turkish Get-Up", sk: "Turkish get-up" },
  "kettlebell_clean_and_press": { en: "Kettlebell Clean & Press", sk: "Kettlebell clean & press" },
  "medicine_ball_slam": { en: "Medicine Ball Slam", sk: "Hod medicinbalom o zem (Slam)" },
  "rope_climb": { en: "Rope Climb", sk: "Lezenie po lane" },
  "dead_hang": { en: "Dead Hang (Grip Endurance)", sk: "Vis na hrazde (Dead hang)" },
  "monkey_bar_traverse": { en: "Monkey Bar Traverse", sk: "Opičia dráha (Monkey bars)" },
};
