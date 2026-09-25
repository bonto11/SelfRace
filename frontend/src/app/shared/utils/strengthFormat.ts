// src/app/shared/utils/strengthFormat.ts
// 🌟 NOVÉ: spoločné formátovanie predpisu cviku (plán aj zápis).
// Predtým si každý komponent riešil "105s" sám a rôzne.

import { getExerciseMeta, repsUnitLabel } from "@/app/shared/constants/strengthMeta";

/**
 * Pauza čitateľne: pod minútu sekundy ("45s"), inak "1:45 min".
 * 105s sa medzi sériami zle číta.
 */
export function formatRest(sec: number | null | undefined): string | null {
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")} min`;
}

/**
 * Opakovania / výdrž / vzdialenosť. Backend posiela reps buď ako počet
 * ("8-12"), čas ("30-45s") alebo vzdialenosť ("20-30m") - podľa `measure`
 * v katalógu. Jednotku dopĺňame len k opakovaniam, čas a vzdialenosť už
 * jednotku v sebe majú.
 */
export function formatReps(
  reps: string | number | null | undefined,
  repsUnitFallback = "opak.",
): string | null {
  if (reps === null || reps === undefined || reps === "") return null;
  const s = String(reps).trim();
  if (/[sm]$/i.test(s) || s.includes("min")) return s;
  return `${s} ${repsUnitFallback}`;
}

/** Jedna riadková rekapitulácia: "4 sérií · 6-8 opak. · Pauza 2:30 min" */
export function formatPrescription(
  input: {
    sets?: number | null;
    reps?: string | number | null;
    rest_s?: number | null;
    seconds?: number | null;
  },
  labels: { sets: string; reps: string; rest: string; sec: string },
): string | null {
  const parts = [
    input.sets ? `${input.sets} ${labels.sets}` : null,
    formatReps(input.reps, labels.reps),
    input.seconds ? `${input.seconds}${labels.sec}` : null,
    formatRest(input.rest_s) ? `${labels.rest} ${formatRest(input.rest_s)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Jednotka pre pole zápisu podľa cviku: opakovania / s / m */
export function repsUnitForExercise(exerciseId: string): "reps" | "s" | "m" {
  return repsUnitLabel(getExerciseMeta(exerciseId).measure);
}