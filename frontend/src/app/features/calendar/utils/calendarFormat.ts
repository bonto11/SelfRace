// src/features/calendar/utils/calendarFormat.ts
import { detectSport } from "@/app/shared/utils/sports";
import type{ PlanStatus } from "@/app/features/calendar/types/calendarTypes";

type AnyObj = Record<string, any>;

export function isRestSession(row: any, sess: AnyObj): boolean {
  const sport = (row as any).sport || detectSport(sess) || "other";
  const duration = sess.duration_min ?? row.duration_min ?? null;
  const title = String(sess.title || sess.session_type || row.title || row.session_type || "");

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

export function planStatusForDate(dIso: string, todayIso: string, actId: number | null): PlanStatus {
  if (actId) return "done";
  return dIso < todayIso ? "missed" : "planned";
}