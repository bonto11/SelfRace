// src/features/calendar/detail/unifiedSession.ts
export type UnifiedKind = "activity" | "plan" | "external";
export type UnifiedStatus = "planned" | "done" | "missed";

export type UnifiedKpi = { label: string; value: string };

export type UnifiedSession = {
  kind: UnifiedKind;
  id: string;

  dateIso: string;
  sport: string;

  title: string;
  subtitle?: string | null;

  status?: UnifiedStatus;

  kpis?: UnifiedKpi[];
  notes?: string | null;

  // iba pre activity
  activityId?: number | null;

  // extra info pre plan/external (debug / budúce)
  raw?: any;
};