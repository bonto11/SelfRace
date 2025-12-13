import type { DayAbbrev } from "@/shared/types/day";

/* -------- kategórie -------- */

export type ExternalCategory = "sport" | "event";

export type ExternalSport =
  // športy
  | "run"
  | "ride"
  | "strength"
  | "swim"
  | "football"
  | "badminton"
  | "floorbal"
  | "padel"
  | "tennis"
  | "other"
  // eventy / životné veci
  | "wedding"
  | "travel"
  | "party"
  | "work"
  | "family"
  | "other_event";

export type ExternalIntensity = "low" | "moderate" | "high";
export type ExternalRecurrenceKind = "weekly" | "single";

export type ExternalActivity = {
  /** sport vs event – čisto FE pomocné pole */
  category?: ExternalCategory;
  /** deň v týždni (pri weekly) */
  day: DayAbbrev;
  sport: ExternalSport;
  intensity: ExternalIntensity;
  note?: string;
  mode?: ExternalRecurrenceKind; // default = "weekly"
  date_single?: string | null;   // "YYYY-MM-DD" pri mode === "single"
  time?: string | null;          // "HH:MM" (24h)
};

/** zodpovedá DB tabuľke coach_external_events (+ pár optional fieldov) */
export type ExternalEvent = {
  id?: number;
  user_id: number;
  title: string;
  sport: ExternalSport | null;
  weekday: number;                     // 1–7
  recurrence_kind: "weekly" | "single";
  single_date?: string | null;         // ISO "YYYY-MM-DD"
  start_time_local?: string | null;    // "HH:MM"
  duration_min: number | null;
  priority: "fixed" | "optional";
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  /** voliteľne z BE pri window-endpointe */
  occurrence_date?: string | null;
};