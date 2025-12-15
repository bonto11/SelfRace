import type { ExternalEvent } from "@/features/coach/types/externalEvents";
import type { PlanStatus } from "@/shared/components/PlanSingle";

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