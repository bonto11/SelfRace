"use client";

import { useCallback, useEffect, useState } from "react";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiTrainerOverview, type TrainerOverview } from "@/app/features/trainer/api/trainer";

/**
 * Stav párovania s trénerom. Nejde cez data provider – nie je to widget,
 * číta sa len v Coach prefs a v Nastaveniach a vždy má byť čerstvý
 * (žiadosť môže prísť kedykoľvek).
 */
export function useTrainerOverview() {
  const { userId } = useUserId();
  const [overview, setOverview] = useState<TrainerOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    const next = await apiTrainerOverview(Number(userId));
    setOverview(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { userId: userId ? Number(userId) : null, overview, loading, reload, setOverview };
}
