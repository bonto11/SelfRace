// src/app/features/nutrition/utils/nutrition.ts
import { appColors } from "@/app/shared/ui/theme/app_colors";
import type { TKey } from "@/app/shared/i18n/useT";
import type { FoodItem, Macros } from "@/app/features/nutrition/types/nutrition";

type T = (key: TKey, fallback?: string) => string;

export type MacroKey = "protein_g" | "carbs_g" | "fat_g";
export const MACRO_KEYS: MacroKey[] = ["protein_g", "carbs_g", "fat_g"];

export const MACRO_COLOR: Record<MacroKey | "kcal", string> = {
  kcal: appColors.nutritionKcal,
  protein_g: appColors.nutritionProtein,
  carbs_g: appColors.nutritionCarbs,
  fat_g: appColors.nutritionFat,
};

/** celé číslo podľa jazyka (2 450) */
export function fmtInt(v: number | null | undefined, locale: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Math.round(v).toLocaleString(locale);
}

export function sumMacros(items: Array<Partial<Macros>>): Macros {
  const out: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  for (const it of items) {
    out.kcal += Number(it.kcal) || 0;
    out.protein_g += Number(it.protein_g) || 0;
    out.carbs_g += Number(it.carbs_g) || 0;
    out.fat_g += Number(it.fat_g) || 0;
  }
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Zmena gramov prepočíta kcal aj makrá v rovnakom pomere – user tak
 * opraví len porciu a nemusí prepisovať čísla.
 */
export function scaleItem(item: FoodItem, grams: number | null): FoodItem {
  if (!grams || !item.grams || item.grams <= 0) return { ...item, grams };
  const f = grams / item.grams;
  return {
    ...item,
    grams,
    kcal: r1(item.kcal * f),
    protein_g: r1(item.protein_g * f),
    carbs_g: r1(item.carbs_g * f),
    fat_g: r1(item.fat_g * f),
  };
}

/** text pod „i“ – rovnaký vo widgete aj v hlavičke stránky */
export function nutritionInfo(t: T): string {
  return t("nutrition.info.day");
}

/** chyba z API (Error(error_code)) → preložený text */
export function nutritionErrorText(t: T, e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  const key = `nutrition.errors.${code}` as TKey;
  const text = t(key);
  return text === key ? t("nutrition.errors.request_failed") : text;
}
