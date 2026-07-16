// src/features/calendar/utils/calendarFormat.ts
import type { PlanStatus } from "@/app/features/calendar/types/calendarTypes";

type AnyObj = Record<string, any>;

export function isRestSession(row: any, sess: AnyObj): boolean {
  // 🌟 FIX: zjednotené na duration_min-only pravidlo (rovnaké ako BE
  // db_get_compliance_stats a DayDetail.tsx/MiniCalendar.tsx). Predtým
  // "sport === 'other'" samo osebe stačilo na to, aby sa session
  // vyhodnotila ako rest day - to nesprávne zasiahlo aj reálne
  // odtrénované "iné aktivity" (joga a pod.) so sport:'other', ktoré
  // majú duration_min > 0. Rovnako title regex ("rest/voľno/off day")
  // je krehký (jazykovo závislý) - nahradené čisto duration_min.
  const duration = sess.duration_min ?? row.duration_min ?? null;
  return duration == null || Number(duration) === 0;
}

export function planStatusForDate(
  dIso: string,
  todayIso: string,
  actId: number | null,
): PlanStatus {
  if (actId) return "done";
  return dIso < todayIso ? "missed" : "planned";
}
