// src/app/features/coach/constants/sessionTemplates.ts
// Šablóny tréningov pre ručný plán (advisor). Šablóna = predvyplnený stav
// formulára ManualSessionForm - po výbere ho user ďalej upravuje ako keby
// ho vyklikal sám.

import type {
  ActivityLoad,
  EventKind,
  IntervalUnit,
  ManualRunSessionType,
} from "@/app/features/coach/api/advisor_daily";

export type TemplateSport = "run" | "ride" | "swim" | "strength" | "other";

export type TemplateExercise = {
  exercise_id: string;
  sets: number;
  reps: string;
  /** vlastné šablóny si pamätajú aj váhu */
  weight_kg?: number;
};

/** Stav formulára uložený v šablóne. Texty sú už preložené (pri vlastných šablónach). */
export type SessionTemplateData = {
  v: 1;
  sport: TemplateSport;
  title: string;
  durationMin?: number | null;
  notes?: string;
  sessionType?: ManualRunSessionType;
  structureMode?: "simple" | "intervals";
  warmupMin?: number | null;
  cooldownMin?: number | null;
  mainMinutes?: number | null;
  mainNotes?: string;
  rounds?: number | null;
  workUnit?: IntervalUnit;
  workTime?: string;
  workDistance?: number | null;
  workNotes?: string;
  restUnit?: IntervalUnit;
  restTime?: string;
  restDistance?: number | null;
  restNotes?: string;
  exercises?: TemplateExercise[];
  eventKind?: EventKind;
  eventLoad?: ActivityLoad;
  countsAsTraining?: boolean;
};

/** Vlastná šablóna usera - uložená v users_preferences (advisor.session_templates). */
export type UserSessionTemplate = {
  id: string;
  name: string;
  created_at: string;
  data: SessionTemplateData;
};

/**
 * Vstavaná šablóna. Texty (názov, poznámky) sú i18n kľúče pod
 * advisorDaily.templates.items.<id> - preložia sa pri výbere.
 */
export type BuiltinSessionTemplate = {
  id: string;
  data: Omit<SessionTemplateData, "title" | "notes" | "mainNotes" | "workNotes" | "restNotes">;
  /** ktoré texty má šablóna v i18n (title je vždy) */
  texts: Array<"mainNotes" | "workNotes" | "restNotes">;
};

const ex = (exercise_id: string, sets: number, reps: string): TemplateExercise => ({
  exercise_id,
  sets,
  reps,
});

export const BUILTIN_SESSION_TEMPLATES: BuiltinSessionTemplate[] = [
  // ---------- BEH ----------
  {
    id: "easy_run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "easy", structureMode: "simple", mainMinutes: 40 },
  },
  {
    id: "recovery_run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "recovery", structureMode: "simple", mainMinutes: 30 },
  },
  {
    id: "long_run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "long", structureMode: "simple", mainMinutes: 75 },
  },
  {
    id: "tempo_run",
    texts: ["mainNotes"],
    data: {
      v: 1, sport: "run", sessionType: "tempo", structureMode: "simple",
      warmupMin: 15, mainMinutes: 20, cooldownMin: 10,
    },
  },
  {
    id: "intervals_400",
    texts: ["workNotes", "restNotes"],
    data: {
      v: 1, sport: "run", sessionType: "interval", structureMode: "intervals",
      warmupMin: 15, cooldownMin: 10, rounds: 8,
      workUnit: "distance", workDistance: 400,
      restUnit: "time", restTime: "01:30",
    },
  },
  {
    id: "vo2max_4x4",
    texts: ["workNotes", "restNotes"],
    data: {
      v: 1, sport: "run", sessionType: "interval", structureMode: "intervals",
      warmupMin: 15, cooldownMin: 10, rounds: 4,
      workUnit: "time", workTime: "04:00",
      restUnit: "time", restTime: "03:00",
    },
  },
  {
    id: "hill_repeats",
    texts: ["workNotes", "restNotes"],
    data: {
      v: 1, sport: "run", sessionType: "interval", structureMode: "intervals",
      warmupMin: 15, cooldownMin: 10, rounds: 8,
      workUnit: "time", workTime: "01:00",
      restUnit: "time", restTime: "02:00",
    },
  },

  // ---------- BICYKEL / PLÁVANIE ----------
  {
    id: "easy_ride",
    texts: ["mainNotes"],
    data: { v: 1, sport: "ride", sessionType: "easy", structureMode: "simple", mainMinutes: 60 },
  },
  {
    id: "easy_swim",
    texts: ["mainNotes"],
    data: { v: 1, sport: "swim", sessionType: "easy", structureMode: "simple", mainMinutes: 30 },
  },

  // ---------- SILOVÝ ----------
  {
    id: "full_body_home",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 30,
      exercises: [
        ex("bodyweight_squat", 3, "12-15"),
        ex("pushup", 3, "8-12"),
        ex("glute_bridge_bodyweight", 3, "12-15"),
        ex("split_squat", 3, "8-10"),
        ex("plank", 3, "30-45"),
        ex("dead_bug", 2, "8-10"),
      ],
    },
  },
  {
    id: "full_body_a",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("goblet_squat", 3, "8-12"),
        ex("romanian_deadlift_dumbbell", 3, "8-10"),
        ex("incline_db_press", 3, "8-10"),
        ex("dumbbell_row", 3, "8-10"),
        ex("plank", 3, "30-45"),
        ex("standing_calf_raise", 3, "12-15"),
      ],
    },
  },
  {
    id: "full_body_b",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("bulgarian_split_squat", 3, "8-10"),
        ex("hip_thrust_barbell", 3, "8-12"),
        ex("shoulder_press_dumbbell", 3, "8-10"),
        ex("lat_pulldown_machine", 3, "8-12"),
        ex("side_plank", 3, "30-45"),
        ex("farmers_carry", 3, "30"),
      ],
    },
  },
  {
    id: "upper_body",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 45,
      exercises: [
        ex("bench_press_barbell", 4, "6-8"),
        ex("barbell_row", 4, "6-8"),
        ex("shoulder_press_dumbbell", 3, "8-10"),
        ex("lat_pulldown_machine", 3, "8-12"),
        ex("face_pull", 3, "12-15"),
        ex("triceps_pushdown", 2, "10-12"),
      ],
    },
  },
  {
    id: "lower_body",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 45,
      exercises: [
        ex("barbell_back_squat", 4, "5-8"),
        ex("romanian_deadlift_barbell", 3, "6-8"),
        ex("walking_lunge", 3, "10-12"),
        ex("hamstring_curl_machine", 3, "10-12"),
        ex("standing_calf_raise", 3, "12-15"),
        ex("tibialis_raise", 2, "15"),
      ],
    },
  },
  {
    id: "core_stability",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 20,
      exercises: [
        ex("plank", 3, "30-45"),
        ex("side_plank", 2, "30"),
        ex("dead_bug", 3, "8-10"),
        ex("bird_dog", 3, "8-10"),
        ex("hollow_body_hold", 2, "20-30"),
      ],
    },
  },
];

/** Max počet vlastných šablón - aby jeden JSON v users_preferences nerástol donekonečna. */
export const MAX_USER_TEMPLATES = 30;
export const USER_TEMPLATES_PREF_KEY = "advisor.session_templates";
