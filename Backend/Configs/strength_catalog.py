# Configs/strength_catalog.py

STRENGTH_EXERCISE_CATALOG = [
    # --- CORE ---
    {"id": "plank", "name_en": "Plank", "target": "core", "equipment": ["none"]},
    {"id": "side_plank", "name_en": "Side Plank", "target": "core", "equipment": ["none"]},
    {"id": "abwheel_rollout", "name_en": "Ab Wheel Rollout", "target": "core", "equipment": ["abwheel"]},
    {"id": "hanging_knee_raise", "name_en": "Hanging Knee Raise", "target": "core", "equipment": ["pullup_bar"]},
    {"id": "cable_chop", "name_en": "Cable Woodchop", "target": "core", "equipment": ["cable"]},
    {"id": "bird_dog", "name_en": "Bird-Dog", "target": "core", "equipment": ["none"]},
    {"id": "dead_bug", "name_en": "Dead Bug", "target": "core", "equipment": ["none"]},
    {"id": "russian_twist", "name_en": "Russian Twist", "target": "core", "equipment": ["none", "dumbbell", "kettlebell"]},
    {"id": "mountain_climber", "name_en": "Mountain Climber", "target": "core", "equipment": ["none"]},
    {"id": "hollow_body_hold", "name_en": "Hollow Body Hold", "target": "core", "equipment": ["none"]},

    # --- LOWER BODY (QUADS) ---
    {"id": "bodyweight_squat", "name_en": "Bodyweight Squat", "target": "lower_quad", "equipment": ["none"]},
    {"id": "barbell_back_squat", "name_en": "Barbell Back Squat", "target": "lower_quad", "equipment": ["barbell"]},
    {"id": "leg_press_machine", "name_en": "Leg Press", "target": "lower_quad", "equipment": ["machine"]},
    {"id": "split_squat", "name_en": "Split Squat", "target": "lower_quad", "equipment": ["none", "dumbbell"]},
    {"id": "goblet_squat", "name_en": "Goblet Squat", "target": "lower_quad", "equipment": ["dumbbell", "kettlebell"]},
    {"id": "box_stepup", "name_en": "Box Step-up", "target": "lower_quad", "equipment": ["none", "dumbbell"]},
    {"id": "bulgarian_split_squat", "name_en": "Bulgarian Split Squat", "target": "lower_quad", "equipment": ["none", "dumbbell", "bench"]},
    {"id": "walking_lunge", "name_en": "Walking Lunge", "target": "lower_quad", "equipment": ["none", "dumbbell"]},
    {"id": "hack_squat_machine", "name_en": "Hack Squat", "target": "lower_quad", "equipment": ["machine"]},
    {"id": "leg_extension_machine", "name_en": "Leg Extension", "target": "lower_quad", "equipment": ["machine"]},

    # --- LOWER BODY (POSTERIOR) ---
    {"id": "glute_bridge_bodyweight", "name_en": "Glute Bridge", "target": "lower_posterior", "equipment": ["none"]},
    {"id": "romanian_deadlift_barbell", "name_en": "Barbell Romanian Deadlift", "target": "lower_posterior", "equipment": ["barbell"]},
    {"id": "romanian_deadlift_dumbbell", "name_en": "Dumbbell RDL", "target": "lower_posterior", "equipment": ["dumbbell"]},
    {"id": "single_leg_deadlift_band", "name_en": "Single Leg Deadlift", "target": "lower_posterior", "equipment": ["none", "resistance_bands", "dumbbell"]},
    {"id": "hamstring_curl_machine", "name_en": "Hamstring Curl", "target": "lower_posterior", "equipment": ["machine"]},
    {"id": "hip_thrust_barbell", "name_en": "Barbell Hip Thrust", "target": "lower_posterior", "equipment": ["barbell"]},
    {"id": "kettlebell_swing", "name_en": "Kettlebell Swing", "target": "lower_posterior", "equipment": ["kettlebell", "dumbbell"]},
    {"id": "conventional_deadlift", "name_en": "Conventional Deadlift", "target": "lower_posterior", "equipment": ["barbell"]},
    {"id": "good_morning_barbell", "name_en": "Barbell Good Morning", "target": "lower_posterior", "equipment": ["barbell"]},
    {"id": "back_extension", "name_en": "Back Extension", "target": "lower_posterior", "equipment": ["machine", "none"]},

    # --- LOWER BODY (CALVES & ANKLES) ---
    {"id": "standing_calf_raise", "name_en": "Standing Calf Raise", "target": "lower_calves", "equipment": ["none", "dumbbell", "machine"]},
    {"id": "seated_calf_raise", "name_en": "Seated Calf Raise", "target": "lower_calves", "equipment": ["machine", "dumbbell"]},
    {"id": "single_leg_calf_raise", "name_en": "Single Leg Calf Raise", "target": "lower_calves", "equipment": ["none", "dumbbell"]},
    {"id": "jump_rope", "name_en": "Jump Rope (Pogo Jumps)", "target": "lower_calves", "equipment": ["none"]},
    {"id": "tibialis_raise", "name_en": "Tibialis Raise", "target": "lower_calves", "equipment": ["none", "resistance_bands"]},

    # --- UPPER PULL ---
    {"id": "bodyweight_row", "name_en": "Inverted Row", "target": "upper_pull", "equipment": ["barbell", "trx"]},
    {"id": "trx_row", "name_en": "TRX Row", "target": "upper_pull", "equipment": ["trx"]},
    {"id": "lat_pulldown_machine", "name_en": "Lat Pulldown", "target": "upper_pull", "equipment": ["machine"]},
    {"id": "pullup_assisted", "name_en": "Assisted Pull-up", "target": "upper_pull", "equipment": ["pullup_bar"]},
    {"id": "pullup_strict", "name_en": "Strict Pull-up", "target": "upper_pull", "equipment": ["pullup_bar"]},
    {"id": "dumbbell_row", "name_en": "Single Arm Dumbbell Row", "target": "upper_pull", "equipment": ["dumbbell", "bench"]},
    {"id": "barbell_row", "name_en": "Barbell Bent-Over Row", "target": "upper_pull", "equipment": ["barbell"]},
    {"id": "seated_cable_row", "name_en": "Seated Cable Row", "target": "upper_pull", "equipment": ["cable"]},
    {"id": "face_pull", "name_en": "Face Pull", "target": "upper_pull", "equipment": ["cable", "resistance_bands"]},
    {"id": "chin_up", "name_en": "Chin-up", "target": "upper_pull", "equipment": ["pullup_bar"]},

    # --- UPPER PUSH ---
    {"id": "pushup", "name_en": "Push-up", "target": "upper_push", "equipment": ["none"]},
    {"id": "bench_press_barbell", "name_en": "Barbell Bench Press", "target": "upper_push", "equipment": ["barbell", "bench"]},
    {"id": "incline_db_press", "name_en": "Incline Dumbbell Press", "target": "upper_push", "equipment": ["dumbbell", "bench"]},
    {"id": "shoulder_press_dumbbell", "name_en": "Dumbbell Shoulder Press", "target": "upper_push", "equipment": ["dumbbell"]},
    {"id": "dip_assisted", "name_en": "Assisted Dips", "target": "upper_push", "equipment": ["machine", "pullup_bar"]},
    {"id": "dip_strict", "name_en": "Strict Dips", "target": "upper_push", "equipment": ["pullup_bar"]},
    {"id": "overhead_press_barbell", "name_en": "Overhead Press", "target": "upper_push", "equipment": ["barbell"]},
    {"id": "push_press", "name_en": "Push Press", "target": "upper_push", "equipment": ["barbell", "dumbbell"]},
    {"id": "pec_deck_fly", "name_en": "Pec Deck Fly", "target": "upper_push", "equipment": ["machine"]},
    {"id": "triceps_pushdown", "name_en": "Cable Triceps Pushdown", "target": "upper_push", "equipment": ["cable"]},
]