// src/app/features/nutrition/utils/fuel.ts
// Palivo okolo tréningov a pretekov + tanier pre režim bez počítania.
// Čísla počíta BE (Services/nutrition_fuel.py), tu sa len skladá text.

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, type TKey } from "@/app/shared/i18n/useT";
import type { DayLoad, FuelTip, NutritionMode } from "@/app/features/nutrition/types/nutrition";
import type { Tone } from "@/app/shared/ui/widget/WidgetParts";

type T = (key: TKey, fallback?: string) => string;

/** rady, ktoré v režime bez počítania nemajú zmysel (sú o deficite v kcal) */
const SIMPLE_HIDDEN = new Set<FuelTip["kind"]>(["soft_deficit"]);

export function visibleTips(tips: FuelTip[], mode: NutritionMode | undefined): FuelTip[] {
  return mode === "simple" ? tips.filter((tip) => !SIMPLE_HIDDEN.has(tip.kind)) : tips;
}

export function fuelTipText(t: T, tip: FuelTip, locale: string, mode: NutritionMode | undefined): string {
  const simple = mode === "simple";
  const n = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toLocaleString(locale));
  const vars: Record<string, string | number> = {
    c: n(tip.carbs_g),
    p: n(tip.protein_g),
    r: n(tip.carbs_g_per_h),
    f: n(tip.fluid_ml_per_h),
    t: n(tip.total_carbs_g),
    h: tip.hours != null ? tip.hours.toLocaleString(locale) : "—",
    k: tip.carbs_g_per_kg != null ? tip.carbs_g_per_kg.toLocaleString(locale) : "—",
    title: tip.title || t("nutrition.fuel.session"),
    race: tip.race_name || t("nutrition.fuel.raceUnnamed"),
    next: t(`nutrition.fuel.next.${tip.next ?? "hard"}` as TKey),
  };
  const key = `nutrition.fuel.${simple ? "simple" : "tips"}.${tip.kind}` as TKey;
  const text = t(key);
  // režim bez počítania má vlastný text len tam, kde by inak boli gramy
  return fmt(text === key ? t(`nutrition.fuel.tips.${tip.kind}` as TKey) : text, vars);
}

export function loadTone(load: DayLoad | null | undefined): Tone {
  if (load === "race" || load === "load") return "info";
  if (load === "hard") return "warn";
  if (load === "moderate") return "good";
  return "neutral";
}

/* ---------- tanier (režim bez počítania) ---------- */

export type PlatePart = "veg" | "protein" | "carbs";

/**
 * Pomer taniera podľa záťaže dňa – podľa „Athlete's Plate“ (ľahký /
 * stredný / náročný deň): s tréningom rastie príloha, zelenina ubúda.
 */
export const PLATE_BY_LOAD: Record<DayLoad, Record<PlatePart, number>> = {
  rest: { veg: 50, protein: 25, carbs: 25 },
  easy: { veg: 40, protein: 25, carbs: 35 },
  moderate: { veg: 33, protein: 25, carbs: 42 },
  hard: { veg: 25, protein: 25, carbs: 50 },
  load: { veg: 15, protein: 20, carbs: 65 },
  race: { veg: 15, protein: 20, carbs: 65 },
};

export const PLATE_COLOR: Record<PlatePart, string> = {
  veg: appColors.nutritionVeg,
  protein: appColors.nutritionProtein,
  carbs: appColors.nutritionCarbs,
};

export const PLATE_PARTS: PlatePart[] = ["carbs", "protein", "veg"];
