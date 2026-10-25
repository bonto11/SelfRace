// src/app/features/nutrition/hooks/useNutritionWeek.ts
import { useEffect } from "react";
import { useCachedResource } from "@/app/shared/components/dataProviders/useCachedResource";
import { todayLocalISO } from "@/app/shared/utils/time";
import { apiNutritionWeek } from "@/app/features/nutrition/api/nutrition";
import type { NutritionWeek } from "@/app/features/nutrition/types/nutrition";

/**
 * Posledných 7 dní (graf, priemery, varovania). Jeden zdroj pre celú
 * stránku – týždňová karta aj varovania ho len čítajú.
 * `version` zvýšená = zápis sa zmenil, načítaj znova.
 */
export function useNutritionWeek(userId: number, version: number) {
  const today = todayLocalISO();
  const res = useCachedResource<NutritionWeek>({
    key: `nutrition:week:${userId}:${today}`,
    fetcher: () => apiNutritionWeek(userId),
    eager: true,
  });
  const { refresh } = res;
  useEffect(() => {
    if (version > 0) void refresh();
  }, [version, refresh]);
  return res;
}
