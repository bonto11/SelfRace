"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { todayLocalISO } from "@/app/shared/utils/time";
import { apiGetNutritionDay, apiNutritionFuel } from "@/app/features/nutrition/api/nutrition";
import type { NutritionDay, NutritionFuel } from "@/app/features/nutrition/types/nutrition";
import {
  useCachedResource,
  useEnsure,
  type CachedResource,
} from "@/app/shared/components/dataProviders/useCachedResource";

/*
 * Výživa – dnešný deň (ciele + zjedené) pre widget na Domove a v sekcii
 * a palivo na dnes + 2 dni (tréningy, preteky, rady).
 * Lenivé zdroje: kým výživu nikto nepoužije (funkcia je za prepínačom),
 * nič sa neťahá. Stránka /nutrition si iné dni načítava sama.
 */

type CtxValue = {
  today: NutritionDay | null;
  /** true len keď ešte nemáme žiadne dáta */
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
};

type InternalCtx = CtxValue & {
  resource: CachedResource<NutritionDay>;
  fuel: CachedResource<NutritionFuel>;
};

const NutritionDataContext = createContext<InternalCtx | null>(null);

export function useNutritionData(): CtxValue {
  const ctx = useContext(NutritionDataContext);
  if (!ctx) throw new Error("useNutritionData must be used within NutritionDataProvider");
  useEnsure(ctx.resource);
  return ctx;
}

/** palivo na dnes a ďalšie dni (widget, stránka /nutrition) */
export function useNutritionFuel(): CachedResource<NutritionFuel> {
  const ctx = useContext(NutritionDataContext);
  if (!ctx) throw new Error("useNutritionFuel must be used within NutritionDataProvider");
  useEnsure(ctx.fuel);
  return ctx.fuel;
}

/** kľúč cache dňa – rovnaký pre provider aj stránku /nutrition */
export function nutritionDayKey(userId: number | null, date: string): string | null {
  return userId ? `nutrition:day:${userId}:${date}` : null;
}

export function NutritionDataProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useUserId();
  // dátum sa zistí pri rendri – po polnoci ďalší render prepne kľúč na nový deň
  const today = todayLocalISO();

  const resource = useCachedResource<NutritionDay>({
    key: nutritionDayKey(userId, today),
    fetcher: () => apiGetNutritionDay(Number(userId), today),
  });

  const fuel = useCachedResource<NutritionFuel>({
    key: userId ? `nutrition:fuel:${userId}:${today}` : null,
    fetcher: () => apiNutritionFuel(Number(userId)),
  });

  // dnešok vždy, palivo len keď ho niekto použil
  const refresh = useCallback(async () => {
    await Promise.all([resource.refresh(), fuel.revalidate()]);
  }, [resource, fuel]);

  const value = useMemo<InternalCtx>(
    () => ({
      today: resource.data ?? null,
      loading: !resource.loaded,
      error: resource.error,
      refresh,
      resource,
      fuel,
    }),
    [resource, fuel, refresh],
  );

  return <NutritionDataContext.Provider value={value}>{children}</NutritionDataContext.Provider>;
}
