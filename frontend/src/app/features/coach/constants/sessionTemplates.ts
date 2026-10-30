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

/**
 * Kategórie vo výbere šablón (čipy nad zoznamom). „Moje“ = vlastné šablóny
 * usera, ostatné filtrujú vstavané. Kategória nie je šport – chôdza a jóga
 * sú v pláne aktivita (sport "other"), ale user ich hľadá ako šport.
 */
export type TemplateCategory = "mine" | "run" | "strength" | "walk" | "recovery" | "other";
export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["mine", "run", "strength", "walk", "recovery", "other"];

/** Kategórie za prepínačom funkcie (bez nej sa nezobrazia). */
export const TEMPLATE_CATEGORY_FEATURE: Partial<Record<TemplateCategory, "recovery_extras">> = {
  recovery: "recovery_extras",
};

export type TemplateExercise = {
  exercise_id: string;
  sets: number;
  reps: string;
  /** vlastné šablóny si pamätajú aj váhu */
  weight_kg?: number;
};

/** Jedna séria intervalov v šablóne (rovnaké polia ako jednobloková šablóna). */
export type TemplateIntervalBlock = {
  rounds: number | null;
  workUnit: IntervalUnit;
  workTime?: string;
  workDistance?: number | null;
  workNotes?: string;
  restUnit: IntervalUnit;
  restTime?: string;
  restDistance?: number | null;
  restNotes?: string;
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
  /** viac sérií; staršie a vstavané šablóny majú jednu sériu v plochých poliach */
  blocks?: TemplateIntervalBlock[];
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
  category: Exclude<TemplateCategory, "mine">;
  data: Omit<SessionTemplateData, "title" | "notes" | "mainNotes" | "workNotes" | "restNotes">;
  /** ktoré texty má šablóna v i18n (title je vždy) */
  texts: Array<"notes" | "mainNotes" | "workNotes" | "restNotes">;
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
    category: "run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "easy", structureMode: "simple", mainMinutes: 40 },
  },
  {
    id: "recovery_run",
    category: "run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "recovery", structureMode: "simple", mainMinutes: 30 },
  },
  {
    id: "long_run",
    category: "run",
    texts: ["mainNotes"],
    data: { v: 1, sport: "run", sessionType: "long", structureMode: "simple", mainMinutes: 75 },
  },
  {
    id: "tempo_run",
    category: "run",
    texts: ["mainNotes"],
    data: {
      v: 1, sport: "run", sessionType: "tempo", structureMode: "simple",
      warmupMin: 15, mainMinutes: 20, cooldownMin: 10,
    },
  },
  {
    id: "intervals_400",
    category: "run",
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
    category: "run",
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
    category: "run",
    texts: ["workNotes", "restNotes"],
    data: {
      v: 1, sport: "run", sessionType: "interval", structureMode: "intervals",
      warmupMin: 15, cooldownMin: 10, rounds: 8,
      workUnit: "time", workTime: "01:00",
      restUnit: "time", restTime: "02:00",
    },
  },

  // ---------- CHÔDZA ----------
  // Chôdza nie je samostatný šport plánu – je to aktivita (sport "other",
  // druh „šport“, ráta sa do tréningu). Plán, kalendár aj AI ju už poznajú,
  // nový šport by znamenal zmeny v celom pláne.
  {
    id: "walk_brisk",
    category: "walk",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 40, eventKind: "sport", eventLoad: "easy", countsAsTraining: true },
  },
  {
    id: "walk_nordic",
    category: "walk",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 50, eventKind: "sport", eventLoad: "easy", countsAsTraining: true },
  },
  {
    id: "hike",
    category: "walk",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 150, eventKind: "sport", eventLoad: "moderate", countsAsTraining: true },
  },

  // ---------- REGENERÁCIA (nie tréning – do objemu sa neráta, po termíne nie je zmeškaná) ----------
  {
    id: "sauna",
    category: "recovery",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 30, eventKind: "recovery", eventLoad: "easy", countsAsTraining: false },
  },
  {
    id: "cold_exposure",
    category: "recovery",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 10, eventKind: "recovery", eventLoad: "easy", countsAsTraining: false },
  },
  {
    id: "massage",
    category: "recovery",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 60, eventKind: "recovery", eventLoad: "easy", countsAsTraining: false },
  },
  {
    id: "mobility_roll",
    category: "recovery",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 20, eventKind: "recovery", eventLoad: "easy", countsAsTraining: false },
  },
  {
    id: "breathing",
    category: "recovery",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 10, eventKind: "recovery", eventLoad: "easy", countsAsTraining: false },
  },

  // ---------- ĎALŠIE (bicykel, plávanie, jóga) ----------
  {
    id: "easy_ride",
    category: "other",
    texts: ["mainNotes"],
    data: { v: 1, sport: "ride", sessionType: "easy", structureMode: "simple", mainMinutes: 60 },
  },
  {
    id: "easy_swim",
    category: "other",
    texts: ["mainNotes"],
    data: { v: 1, sport: "swim", sessionType: "easy", structureMode: "simple", mainMinutes: 30 },
  },

  {
    id: "yoga",
    category: "other",
    texts: ["notes"],
    data: { v: 1, sport: "other", durationMin: 45, eventKind: "sport", eventLoad: "easy", countsAsTraining: true },
  },

  // ---------- SILOVÝ ----------
  {
    id: "full_body_home",
    category: "strength",
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
    // 2× týždenne: A + B. Každý pohyb (drep, hip hinge, tlak, ťah, výpad, core, nosenie) aspoň raz
    id: "full_body_a",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 55,
      exercises: [
        ex("barbell_back_squat", 3, "6-8"),
        ex("dumbbell_bench_press", 3, "8-10"),
        ex("romanian_deadlift_dumbbell", 3, "8-10"),
        ex("dumbbell_row", 3, "8-10"),
        ex("reverse_lunge", 2, "8-10"),
        ex("pallof_press", 2, "10"),
        ex("farmers_carry", 2, "40"),
      ],
    },
  },
  {
    // 2× týždenne: druhý deň - ťah zo zeme, tlak nad hlavu, jednonož
    id: "full_body_b",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 55,
      exercises: [
        ex("trap_bar_deadlift", 3, "5-8"),
        ex("shoulder_press_dumbbell", 3, "8-10"),
        ex("bulgarian_split_squat", 3, "8-10"),
        ex("lat_pulldown_machine", 3, "10-12"),
        ex("pushup", 2, "8-15"),
        ex("face_pull", 2, "12-15"),
        ex("dead_bug", 2, "8-10"),
      ],
    },
  },
  {
    // 3× týždenne: menej sérií na tréning, každý vzor 2-3× do týždňa
    id: "full_body_3a",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("barbell_back_squat", 3, "6-8"),
        ex("dumbbell_bench_press", 3, "8-10"),
        ex("dumbbell_row", 3, "8-10"),
        ex("reverse_lunge", 2, "8-10"),
        ex("face_pull", 2, "12-15"),
        ex("dead_bug", 2, "8-10"),
      ],
    },
  },
  {
    // 3× týždenne: ťah zo zeme a nad hlavu
    id: "full_body_3b",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("trap_bar_deadlift", 3, "5-8"),
        ex("shoulder_press_dumbbell", 3, "8-10"),
        ex("lat_pulldown_machine", 3, "10-12"),
        ex("bulgarian_split_squat", 2, "8-10"),
        ex("pallof_press", 2, "10"),
        ex("farmers_carry", 2, "40"),
      ],
    },
  },
  {
    // 3× týždenne: ľahší deň - viac opakovaní, zadok a pohyb do strany
    id: "full_body_3c",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("goblet_squat", 3, "10-12"),
        ex("hip_thrust_barbell", 3, "8-12"),
        ex("incline_db_press", 3, "8-10"),
        ex("seated_cable_row", 3, "10-12"),
        ex("lateral_lunge", 2, "8-10"),
        ex("side_plank", 2, "30-45"),
      ],
    },
  },
  {
    // horná + spodná = 2× týždenne. Tlak a ťah v rovnováhe, core a nosenie v každom tréningu
    id: "upper_body",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("dumbbell_bench_press", 3, "8-10"),
        ex("dumbbell_row", 3, "8-10"),
        ex("shoulder_press_dumbbell", 3, "8-10"),
        ex("lat_pulldown_machine", 3, "10-12"),
        ex("face_pull", 2, "12-15"),
        ex("pallof_press", 2, "10"),
        ex("farmers_carry", 2, "40"),
      ],
    },
  },
  {
    // spodná časť: drep, hip hinge, jednonož, do strany + core
    id: "lower_body",
    category: "strength",
    texts: ["notes"],
    data: {
      v: 1, sport: "strength", durationMin: 50,
      exercises: [
        ex("barbell_back_squat", 3, "6-8"),
        ex("romanian_deadlift_dumbbell", 3, "8-10"),
        ex("reverse_lunge", 3, "8-10"),
        ex("hip_thrust_barbell", 2, "8-12"),
        ex("lateral_lunge", 2, "8-10"),
        ex("standing_calf_raise", 2, "12-15"),
        ex("side_plank", 2, "30-45"),
      ],
    },
  },
  {
    id: "core_stability",
    category: "strength",
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
  {
    // odrazy pre bežca - krátke série, plná pauza, kvalita pred únavou
    id: "plyo_runner",
    category: "strength",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 30,
      exercises: [
        ex("a_skip", 2, "20-30"),
        ex("jump_rope", 3, "30"),
        ex("jump_squat", 3, "6-8"),
        ex("split_jump", 3, "6"),
        ex("lateral_bound", 3, "6-8"),
        ex("single_leg_hop", 2, "8-10"),
      ],
    },
  },
  {
    // výdrže pre bežca - šľachy a kolená bez nárazov (aj pri bolesti)
    id: "iso_runner",
    category: "strength",
    texts: [],
    data: {
      v: 1, sport: "strength", durationMin: 25,
      exercises: [
        ex("wall_sit", 3, "30-45"),
        ex("isometric_split_squat_hold", 3, "30"),
        ex("isometric_calf_hold", 3, "30-45"),
        ex("single_leg_bridge_hold", 3, "30"),
        ex("isometric_hamstring_bridge", 2, "30"),
        ex("side_plank", 2, "30"),
      ],
    },
  },
];

/** Max počet vlastných šablón - aby jeden JSON v users_preferences nerástol donekonečna. */
export const MAX_USER_TEMPLATES = 30;
export const USER_TEMPLATES_PREF_KEY = "advisor.session_templates";
