# Configs/strength_catalog.py

STRENGTH_EXERCISE_CATALOG = [
    # --- CORE ---
    {"id": "plank", "name_en": "Plank", "name_sk": "Plank", "target": "core", "equipment": ["none"]},
    {"id": "side_plank", "name_en": "Side Plank", "name_sk": "Bočný plank", "target": "core", "equipment": ["none"]},
    {"id": "abwheel_rollout", "name_en": "Ab Wheel Rollout", "name_sk": "Ab wheel rollout", "target": "core", "equipment": ["abwheel"]},
    {"id": "hanging_knee_raise", "name_en": "Hanging Knee Raise", "name_sk": "Zdvíhanie kolien vo vise", "target": "core", "equipment": ["pullup_bar"]},
    {"id": "cable_chop", "name_en": "Cable Woodchop", "name_sk": "Sťahovanie kladky zboku", "target": "core", "equipment": ["cable"]},
    {"id": "bird_dog", "name_en": "Bird-Dog", "name_sk": "Zdvihy na štyroch (Bird-dog)", "target": "core", "equipment": ["none"]},
    {"id": "dead_bug", "name_en": "Dead Bug", "name_sk": "Mŕtvy chrobák (Dead bug)", "target": "core", "equipment": ["none"]},

    # --- LOWER BODY (QUADS) ---
    {"id": "bodyweight_squat", "name_en": "Bodyweight Squat", "name_sk": "Drep s vlastnou váhou", "target": "lower_quad", "equipment": ["none"]},
    {"id": "barbell_back_squat", "name_en": "Barbell Back Squat", "name_sk": "Drep s veľkou činkou", "target": "lower_quad", "equipment": ["barbell"]},
    {"id": "leg_press_machine", "name_en": "Leg Press", "name_sk": "Leg press stroj", "target": "lower_quad", "equipment": ["machine"]},
    {"id": "split_squat", "name_en": "Split Squat", "name_sk": "Rozdelený drep (Split squat)", "target": "lower_quad", "equipment": ["none", "dumbbell"]},
    {"id": "goblet_squat", "name_en": "Goblet Squat", "name_sk": "Goblet drep", "target": "lower_quad", "equipment": ["dumbbell", "kettlebell"]},
    {"id": "box_stepup", "name_en": "Box Step-up", "name_sk": "Výstupy na debnu", "target": "lower_quad", "equipment": ["none", "dumbbell"]},

    # --- LOWER BODY (POSTERIOR) ---
    {"id": "glute_bridge_bodyweight", "name_en": "Glute Bridge", "name_sk": "Glute bridge", "target": "lower_posterior", "equipment": ["none"]},
    {"id": "romanian_deadlift_barbell", "name_en": "Romanian Deadlift", "name_sk": "Rumunský mŕtvy ťah (Barbell)", "target": "lower_posterior", "equipment": ["barbell"]},
    {"id": "romanian_deadlift_dumbbell", "name_en": "Dumbbell RDL", "name_sk": "Rumunský mŕtvy ťah (Dumbbell)", "target": "lower_posterior", "equipment": ["dumbbell"]},
    {"id": "single_leg_deadlift_band", "name_en": "Single Leg Deadlift", "name_sk": "Mŕtvy ťah na 1 nohe", "target": "lower_posterior", "equipment": ["none", "resistance_bands", "dumbbell"]},
    {"id": "hamstring_curl_machine", "name_en": "Hamstring Curl", "name_sk": "Zakopávanie stroj", "target": "lower_posterior", "equipment": ["machine"]},
    {"id": "hip_thrust_barbell", "name_en": "Barbell Hip Thrust", "name_sk": "Hip thrust s činkou", "target": "lower_posterior", "equipment": ["barbell"]},

    # --- UPPER PULL ---
    {"id": "bodyweight_row", "name_en": "Inverted Row", "name_sk": "Príťahy na hrazde (vodorovne)", "target": "upper_pull", "equipment": ["barbell", "trx"]},
    {"id": "trx_row", "name_en": "TRX Row", "name_sk": "TRX príťahy", "target": "upper_pull", "equipment": ["trx"]},
    {"id": "lat_pulldown_machine", "name_en": "Lat Pulldown", "name_sk": "Sťahovanie kladky na chrbát", "target": "upper_pull", "equipment": ["machine"]},
    {"id": "pullup_assisted", "name_en": "Assisted Pull-up", "name_sk": "Zhyby s dopomocou", "target": "upper_pull", "equipment": ["pullup_bar"]},
    {"id": "dumbbell_row", "name_en": "Single Arm Dumbbell Row", "name_sk": "Príťahy jednoručky v predklone", "target": "upper_pull", "equipment": ["dumbbell", "bench"]},

    # --- UPPER PUSH ---
    {"id": "pushup", "name_en": "Push-up", "name_sk": "Kľuk", "target": "upper_push", "equipment": ["none"]},
    {"id": "bench_press_barbell", "name_en": "Barbell Bench Press", "name_sk": "Tlak na lavičke", "target": "upper_push", "equipment": ["barbell", "bench"]},
    {"id": "incline_db_press", "name_en": "Incline Dumbbell Press", "name_sk": "Tlaky jednoručiek na šikmej lavičke", "target": "upper_push", "equipment": ["dumbbell", "bench"]},
    {"id": "shoulder_press_dumbbell", "name_en": "Dumbbell Shoulder Press", "name_sk": "Tlak jednoručkami nad hlavu", "target": "upper_push", "equipment": ["dumbbell"]},
    {"id": "dip_assisted", "name_en": "Assisted Dips", "name_sk": "Kľuky na bradlách s dopomocou", "target": "upper_push", "equipment": ["machine", "pullup_bar"]},
]