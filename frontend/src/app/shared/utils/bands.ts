import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";
import bodyFatRef from "@/data/BodyFat_Ref_ACE.json";
import rhrRef from "@/data/RHR_Ref_VerywellFit.json";
import type { Band } from "@/app/shared/components/trend/TrendWithBands";

export function calcAge(birthISO?: string | null) {
  if (!birthISO) return null;
  const ms = Date.now() - new Date(birthISO).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export function getVO2Bands(sex: "M" | "F", age: number | null): Band[] {
  if (age == null) return [];
  const g = (vo2Ref as any[]).find(
    (x) => x.sex === sex && age >= x.age_min && age <= x.age_max
  );
  return (g?.ranges ?? []) as Band[];
}

export function getBodyFatBands(sex: "M" | "F" | null): Band[] {
  const g = (bodyFatRef as any[]).find((x) => x.sex === sex);
  return (g?.ranges ?? []) as Band[];
}

export function getRHRBands(sex: "M" | "F", age: number | null): Band[] {
  if (age == null) return [];
  const g = (rhrRef as any[]).find(
    (x) => x.sex === sex && age >= x.age_min && age <= x.age_max
  );
  return (g?.ranges ?? []) as Band[];
}

// HRV – dynamické pásma podľa osobnej baseline (median)
export function getHRVBands(baseline: number | null): Band[] {
  if (!baseline || baseline <= 0) return [];
  const hiMin = baseline * 1.03;
  const normMin = baseline * 0.97;
  const slMin = baseline * 0.93;
  const lowMin = baseline * 0.88;

  return [
    { label: "High", min: hiMin, max: null, color: "#16a34a" },
    { label: "Normal", min: normMin, max: hiMin, color: "#22c55e" },
    { label: "Slightly low", min: slMin, max: normMin, color: "#eab308" },
    { label: "Low", min: lowMin, max: slMin, color: "#f97316" },
    { label: "Very low", min: null, max: lowMin, color: "#dc2626" },
  ];
}
