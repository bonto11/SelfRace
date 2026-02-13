import { ActivityRow } from "@/app/features/activities/types/activities";

export function fmtMin(m?: number) {
  return typeof m === "number" && m > 0 ? `${m} min` : null;
}

export function safeText(value: any): string {
  if (value == null) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function tgtToStr(t: any): string | null {
  if (!t) return null;
  if (typeof t === "string") return t;
  const bits = [t?.pace, t?.power, t?.hr].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export function valOrDash(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

// kadencia – run → steps/min, bike → rpm
export function formatCadenceSummary(s: ActivityRow | null, t: any): string | null {
  if (!s || s.average_cadence_rpm == null) return null;
  const sport = (s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? "").toString().toLowerCase();
  const rpm = s.average_cadence_rpm;

  if (sport.includes("run")) {
    const spm = Math.round(rpm * 2);
    return `${spm} ${t("sessions.detail.unitStepsPerMin")}`;
  }
  return `${rpm} rpm`;
}