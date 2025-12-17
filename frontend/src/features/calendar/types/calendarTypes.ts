import type { ExternalEvent } from "@/features/coach/types/externalEvents";

export type PlanStatus = "planned" | "done" | "missed";

export type CalendarItemStatus = "planned" | "done" | "missed" | "none";
export type CalendarItemKind = "activity" | "plan" | "external";
export type CalendarPlanStatus = "planned" | "done" | "missed";

export type DayPlanItem = {
  id: number;
  sport: SportKey;
  status: PlanStatus;
  activityId?: number | null; // ⬅ doplniť
};

export type SportKey =
  | "run"
  | "ride"
  | "swim"
  | "strength"
  | "mixed"
  | "skate"
  | "walk"
  | "other"
  | string;

export type DayCellData = {
  iso: string;
  inMonth: boolean;
  day: number | null;

  activities: { id: number; sport: SportKey; name: string }[];

  plans: { id: number; sport: SportKey; status: PlanStatus }[];

  externals: {
    id: number;
    sport: SportKey;
    title: string;
    time?: string | null;
    notes?: string | null;
  }[];
};

export type CalendarGridRange = { fromIso: string; toIso: string };

export type CalendarExternalState = {
  rows: ExternalEvent[];
  err: string | null;
};

export type CalendarMapState = {
  byIso: Record<string, DayCellData>;
  cells: DayCellData[];
};
