// src/app/features/strength/constants/strengthCatalog.ts

export type ExerciseLangMap = {
  en: string;
  sk: string;
  cs: string;
};

// Kľúč je exercise_id, hodnota je preklad.
// Poradie a rozdelenie do sekcií kopíruje Configs/strength_catalog.py (BE),
// aby sa dal pri pridávaní nových cvikov jednoducho porovnať riadok po riadku.
export const STRENGTH_CATALOG_FE: Record<string, ExerciseLangMap> = {
  // ================= CORE =================
  "plank": { en: "Plank", sk: "Plank", cs: "Plank" },
  "side_plank": { en: "Side Plank", sk: "Bočný plank", cs: "Boční plank" },
  "abwheel_rollout": { en: "Ab Wheel Rollout", sk: "Ab wheel rollout", cs: "Ab wheel rollout" },
  "hanging_knee_raise": { en: "Hanging Knee Raise", sk: "Zdvíhanie kolien vo vise", cs: "Zvedání kolen ve visu" },
  "cable_chop": { en: "Cable Woodchop", sk: "Sťahovanie kladky zboku", cs: "Stahování kladky zboku" },
  "bird_dog": { en: "Bird-Dog", sk: "Zdvihy na štyroch (Bird-dog)", cs: "Zvedání na čtyřech (Bird-dog)" },
  "dead_bug": { en: "Dead Bug", sk: "Mŕtvy chrobák (Dead bug)", cs: "Mrtvý brouk (Dead bug)" },
  "russian_twist": { en: "Russian Twist", sk: "Ruský twist", cs: "Ruský twist" },
  "mountain_climber": { en: "Mountain Climber", sk: "Horolezec (Mountain climber)", cs: "Horolezec (Mountain climber)" },
  "hollow_body_hold": { en: "Hollow Body Hold", sk: "Kolíska (Hollow hold)", cs: "Kolébka (Hollow hold)" },
  "medicine_ball_rotational_throw": { en: "Rotational Med Ball Throw", sk: "Rotačný hod medicinbalom", cs: "Rotační hod medicinbalem" },

  // ================= LOWER BODY (QUADS) =================
  "bodyweight_squat": { en: "Bodyweight Squat", sk: "Drep s vlastnou váhou", cs: "Dřep s vlastní vahou" },
  "barbell_back_squat": { en: "Barbell Back Squat", sk: "Drep s veľkou činkou", cs: "Dřep s velkou činkou" },
  "front_squat_barbell": { en: "Barbell Front Squat", sk: "Predný drep s činkou (Front squat)", cs: "Přední dřep s činkou (Front squat)" },
  "leg_press_machine": { en: "Leg Press", sk: "Leg press stroj", cs: "Leg press stroj" },
  "split_squat": { en: "Split Squat", sk: "Rozdelený drep (Split squat)", cs: "Dělený dřep (Split squat)" },
  "goblet_squat": { en: "Goblet Squat", sk: "Goblet drep", cs: "Goblet dřep" },
  "box_stepup": { en: "Box Step-up", sk: "Výstupy na debnu", cs: "Výstupy na bednu" },
  "bulgarian_split_squat": { en: "Bulgarian Split Squat", sk: "Bulharský drep", cs: "Bulharský dřep" },
  "walking_lunge": { en: "Walking Lunge", sk: "Kráčavé výpady", cs: "Výpady v chůzi" },
  "hack_squat_machine": { en: "Hack Squat", sk: "Hack drep stroj", cs: "Hack dřep stroj" },
  "leg_extension_machine": { en: "Leg Extension", sk: "Predkopávanie stroj", cs: "Předkopávání stroj" },

  // ================= LOWER BODY (POSTERIOR) =================
  "glute_bridge_bodyweight": { en: "Glute Bridge", sk: "Glute bridge (Dvíhanie panvy)", cs: "Glute bridge (Zvedání pánve)" },
  "romanian_deadlift_barbell": { en: "Barbell Romanian Deadlift", sk: "Rumunský mŕtvy ťah (Činka)", cs: "Rumunský mrtvý tah (Činka)" },
  "romanian_deadlift_dumbbell": { en: "Dumbbell RDL", sk: "Rumunský mŕtvy ťah (Jednoručky)", cs: "Rumunský mrtvý tah (Jednoručky)" },
  "single_leg_deadlift_band": { en: "Single Leg Deadlift", sk: "Mŕtvy ťah na 1 nohe", cs: "Mrtvý tah na 1 noze" },
  "hamstring_curl_machine": { en: "Hamstring Curl", sk: "Zakopávanie stroj", cs: "Zakopávání stroj" },
  "hip_thrust_barbell": { en: "Barbell Hip Thrust", sk: "Hip thrust s činkou", cs: "Hip thrust s činkou" },
  "kettlebell_swing": { en: "Kettlebell Swing", sk: "Kettlebell swing", cs: "Kettlebell swing" },
  "conventional_deadlift": { en: "Conventional Deadlift", sk: "Klasický mŕtvy ťah", cs: "Klasický mrtvý tah" },
  "good_morning_barbell": { en: "Barbell Good Morning", sk: "Good morning s činkou", cs: "Good morning s činkou" },
  "back_extension": { en: "Back Extension", sk: "Extenzie chrbta (Hyperextenzie)", cs: "Extenze zad (Hyperextenze)" },

  // ================= CALVES & ANKLES =================
  "standing_calf_raise": { en: "Standing Calf Raise", sk: "Výpony v stoji", cs: "Výpony ve stoje" },
  "seated_calf_raise": { en: "Seated Calf Raise", sk: "Výpony v sede", cs: "Výpony v sedě" },
  "single_leg_calf_raise": { en: "Single Leg Calf Raise", sk: "Výpony na jednej nohe", cs: "Výpony na jedné noze" },
  "jump_rope": { en: "Jump Rope (Pogo Jumps)", sk: "Švihadlo / Pogo výskoky", cs: "Švihadlo / Pogo výskoky" },
  "tibialis_raise": { en: "Tibialis Raise", sk: "Zdvíhanie špičiek (Tibialis)", cs: "Zvedání špiček (Tibialis)" },

  // ================= UPPER PULL =================
  "bodyweight_row": { en: "Inverted Row", sk: "Príťahy na hrazde (vodorovne)", cs: "Přítahy na hrazdě (vodorovně)" },
  "trx_row": { en: "TRX Row", sk: "TRX príťahy", cs: "TRX přítahy" },
  "lat_pulldown_machine": { en: "Lat Pulldown", sk: "Sťahovanie kladky na chrbát", cs: "Stahování kladky na záda" },
  "pullup_assisted": { en: "Assisted Pull-up", sk: "Zhyby s dopomocou", cs: "Shyby s dopomocí" },
  "pullup_strict": { en: "Strict Pull-up", sk: "Zhyby (Príťahy nadhmatom)", cs: "Shyby (Přítahy nadhmatem)" },
  "dumbbell_row": { en: "Single Arm Dumbbell Row", sk: "Príťahy jednoručky v predklone", cs: "Přítahy jednoručky v předklonu" },
  "barbell_row": { en: "Barbell Bent-Over Row", sk: "Príťahy s veľkou činkou v predklone", cs: "Přítahy s velkou činkou v předklonu" },
  "seated_cable_row": { en: "Seated Cable Row", sk: "Príťahy na spodnej kladke v sede", cs: "Přítahy na spodní kladce v sedě" },
  "face_pull": { en: "Face Pull", sk: "Face pull (Sťahovanie kladky k tvári)", cs: "Face pull (Stahování kladky k obličeji)" },
  "chin_up": { en: "Chin-up", sk: "Zhyby podhmatom", cs: "Shyby podhmatem" },
  "band_pull_apart": { en: "Band Pull-Apart", sk: "Roztiahnutie gumy (Band pull-apart)", cs: "Roztahování gumy (Band pull-apart)" },
  "cable_external_rotation": { en: "Cable External Rotation (Rotator Cuff)", sk: "Vonkajšia rotácia na kladke", cs: "Vnější rotace na kladce" },

  // ================= UPPER PUSH =================
  "pushup": { en: "Push-up", sk: "Kľuk", cs: "Klik" },
  "bench_press_barbell": { en: "Barbell Bench Press", sk: "Tlak na lavičke (Bench press)", cs: "Tlak na lavičce (Bench press)" },
  "incline_db_press": { en: "Incline Dumbbell Press", sk: "Tlaky jednoručiek na šikmej lavičke", cs: "Tlaky jednoruček na šikmé lavičce" },
  "shoulder_press_dumbbell": { en: "Dumbbell Shoulder Press", sk: "Tlak jednoručkami nad hlavu", cs: "Tlak jednoručkami nad hlavu" },
  "dip_assisted": { en: "Assisted Dips", sk: "Kľuky na bradlách s dopomocou", cs: "Kliky na bradlech s dopomocí" },
  "dip_strict": { en: "Strict Dips", sk: "Kľuky na bradlách (Dipy)", cs: "Kliky na bradlech (Dipy)" },
  "overhead_press_barbell": { en: "Overhead Press", sk: "Tlak s veľkou činkou nad hlavu", cs: "Tlak s velkou činkou nad hlavu" },
  "push_press": { en: "Push Press", sk: "Push press (Tlak s dopomocou nôh)", cs: "Push press (Tlak s dopomocí nohou)" },
  "pec_deck_fly": { en: "Pec Deck Fly", sk: "Peck Deck (Rozpažovanie stroj)", cs: "Peck Deck (Rozpažování stroj)" },
  "triceps_pushdown": { en: "Cable Triceps Pushdown", sk: "Sťahovanie kladky na triceps", cs: "Stahování kladky na triceps" },
  "scapular_pushup": { en: "Scapular Push-up (Shoulder Health)", sk: "Lopatkové kľuky (Scapular push-up)", cs: "Lopatkové kliky (Scapular push-up)" },

  // ================= FUNCTIONAL / HYROX / OCR =================
  "farmers_carry": { en: "Farmer's Carry", sk: "Farmer's carry (Nosenie záťaže)", cs: "Farmer's carry (Nošení zátěže)" },
  "sandbag_carry": { en: "Sandbag Carry", sk: "Nosenie vreca s pieskom", cs: "Nošení pytle s pískem" },
  "bucket_carry": { en: "Bucket Carry", sk: "Nosenie vedra", cs: "Nošení kbelíku" },
  "sled_push": { en: "Sled Push", sk: "Tlačenie sane (Sled push)", cs: "Tlačení saní (Sled push)" },
  "sled_pull": { en: "Sled Pull", sk: "Ťahanie sane (Sled pull)", cs: "Tahání saní (Sled pull)" },
  "ski_erg": { en: "Ski Erg", sk: "SkiErg trenažér", cs: "SkiErg trenažér" },
  "rowing_erg": { en: "Rowing Machine (Erg)", sk: "Veslovací trenažér (Rowing erg)", cs: "Veslovací trenažér (Rowing erg)" },
  "assault_bike": { en: "Assault Bike / Echo Bike", sk: "Assault bike / Echo bike", cs: "Assault bike / Echo bike" },
  "wall_ball": { en: "Wall Ball Shot", sk: "Wall ball (Hod loptou na stenu)", cs: "Wall ball (Hod míčem na stěnu)" },
  "thruster": { en: "Thruster (Squat to Press)", sk: "Thruster (Drep s tlakom nad hlavu)", cs: "Thruster (Dřep s tlakem nad hlavu)" },
  "sandbag_lunge": { en: "Sandbag Walking Lunge", sk: "Výpady s vrecom piesku", cs: "Výpady s pytlem písku" },
  "box_jump": { en: "Box Jump", sk: "Skok na debnu (Box jump)", cs: "Skok na bednu (Box jump)" },
  "broad_jump": { en: "Standing Broad Jump", sk: "Skok do diaľky z miesta", cs: "Skok do dálky z místa" },
  "burpee": { en: "Burpee", sk: "Burpee", cs: "Burpee" },
  "devils_press": { en: "Devil's Press", sk: "Devil's press", cs: "Devil's press" },
  "turkish_getup": { en: "Turkish Get-Up", sk: "Turkish get-up", cs: "Turkish get-up" },
  "kettlebell_clean_and_press": { en: "Kettlebell Clean & Press", sk: "Kettlebell clean & press", cs: "Kettlebell clean & press" },
  "medicine_ball_slam": { en: "Medicine Ball Slam", sk: "Hod medicinbalom o zem (Slam)", cs: "Hod medicinbalem o zem (Slam)" },
  "rope_climb": { en: "Rope Climb", sk: "Lezenie po lane", cs: "Šplh na laně" },
  "dead_hang": { en: "Dead Hang (Grip Endurance)", sk: "Vis na hrazde (Dead hang)", cs: "Vis na hrazdě (Dead hang)" },
  "monkey_bar_traverse": { en: "Monkey Bar Traverse", sk: "Opičia dráha (Monkey bars)", cs: "Opičí dráha (Monkey bars)" },

  // ================= DOPLNENÉ ZÁKLADNÉ CVIKY =================
  "dumbbell_biceps_curl": { en: "Dumbbell Biceps Curl", sk: "Bicepsový zdvih s jednoručkami", cs: "Bicepsový zdvih s jednoručkami" },
  "barbell_biceps_curl": { en: "Barbell Biceps Curl", sk: "Bicepsový zdvih s veľkou činkou", cs: "Bicepsový zdvih s velkou činkou" },
  "hammer_curl": { en: "Hammer Curl", sk: "Kladivové zdvihy (Hammer curl)", cs: "Kladivové zdvihy (Hammer curl)" },
  "cable_biceps_curl": { en: "Cable Biceps Curl", sk: "Bicepsový zdvih na kladke", cs: "Bicepsový zdvih na kladce" },
  "overhead_triceps_extension": { en: "Overhead Dumbbell Triceps Extension", sk: "Tricepsový tlak za hlavou s jednoručkou", cs: "Tricepsový tlak za hlavou s jednoručkou" },
  "skull_crusher": { en: "Lying Triceps Extension (Skull Crusher)", sk: "Francúzsky tlak v ľahu", cs: "Francouzský tlak vleže" },
  "close_grip_bench_press": { en: "Close-Grip Bench Press", sk: "Tlak na lavičke úzkym úchopom", cs: "Tlak na lavičce úzkým úchopem" },
  "bench_dip": { en: "Bench Dip", sk: "Dipy na lavičke", cs: "Dipy na lavičce" },
  "lateral_raise": { en: "Dumbbell Lateral Raise", sk: "Upažovanie s jednoručkami", cs: "Upažování s jednoručkami" },
  "rear_delt_fly": { en: "Dumbbell Rear Delt Fly", sk: "Zadné ramená - rozpažovanie v predklone", cs: "Zadní ramena - rozpažování v předklonu" },
  "dumbbell_bench_press": { en: "Dumbbell Bench Press", sk: "Tlak s jednoručkami na rovnej lavičke", cs: "Tlak s jednoručkami na rovné lavičce" },
  "chest_press_machine": { en: "Chest Press Machine", sk: "Tlak na prsia na stroji", cs: "Tlak na prsa na stroji" },
  "cable_fly": { en: "Cable Fly", sk: "Rozpažovanie na kladkách", cs: "Rozpažování na kladkách" },
  "trap_bar_deadlift": { en: "Trap Bar Deadlift", sk: "Mŕtvy ťah s trap bar činkou", cs: "Mrtvý tah s trap bar činkou" },
  "machine_row": { en: "Seated Machine Row", sk: "Veslovanie na stroji v sede", cs: "Veslování na stroji v sedě" },
  "reverse_lunge": { en: "Reverse Lunge", sk: "Výpady vzad", cs: "Výpady vzad" },
  "lateral_lunge": { en: "Lateral Lunge", sk: "Výpady do strany", cs: "Výpady do strany" },
  "single_leg_glute_bridge": { en: "Single-Leg Glute Bridge", sk: "Glute bridge na jednej nohe", cs: "Glute bridge na jedné noze" },
  "nordic_hamstring_curl": { en: "Nordic Hamstring Curl", sk: "Nordický zdvih (hamstringy)", cs: "Nordický zdvih (hamstringy)" },
  "hip_abduction_machine": { en: "Hip Abduction Machine", sk: "Unožovanie na stroji (abdukcia bedra)", cs: "Unožování na stroji (abdukce kyčle)" },
  "lateral_band_walk": { en: "Lateral Band Walk", sk: "Bočná chôdza s gumou", cs: "Boční chůze s gumou" },
  "pallof_press": { en: "Pallof Press", sk: "Pallof press (anti-rotácia)", cs: "Pallof press (anti-rotace)" },
  "lying_leg_raise": { en: "Lying Leg Raise", sk: "Zdvíhanie nôh v ľahu", cs: "Zvedání nohou vleže" },
  "copenhagen_plank": { en: "Copenhagen Plank", sk: "Kodanský plank (adduktory)", cs: "Kodaňský plank (adduktory)" },
  "crunch": { en: "Crunch", sk: "Skracovačky (brušáky)", cs: "Zkracovačky (sedy-lehy)" },
};
