import type { DayAbbrev } from "@/shared/types/day";

/* -------- External sports / events -------- */

export type ExternalSport =
  | "badminton"
  | "floorbal"
  | "football"
  | "padel"
  | "run"
  | "ride"
  | "strength"
  | "swim"
  | "tennis"
  | "other";

export type ExternalIntensity = "low" | "moderate" | "high";

export type ExternalRecurrenceKind = "weekly" | "single";

/**
 * FE reprezentácia – čo edituješ vo formulári.
 */
export type ExternalActivity = {
  /** pri weekly – ktorý deň v týždni */
  day: DayAbbrev;
  sport: ExternalSport;
  intensity: ExternalIntensity;
  note?: string;
  mode?: ExternalRecurrenceKind;  // default weekly
  date_single?: string | null;    // "YYYY-MM-DD" pri single
  time?: string | null;           // "HH:MM"
};

/**
 * DB/BE reprezentácia – shape z tabuľky coach_external_events.
 */
export type ExternalEvent = {
  id?: number;                          // z DB (PK)
  user_id: number;
  title: string;
  sport: ExternalSport | null;
  weekday: number;                      // 1–7, v DB je NOT NULL
  recurrence_kind: "weekly" | "single";
  single_date?: string | null;          // ISO "YYYY-MM-DD" pre single
  start_time_local?: string | null;     // "HH:MM"
  duration_min: number | null;
  priority: "fixed" | "optional";
  notes?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;           // timestamp z DB
};