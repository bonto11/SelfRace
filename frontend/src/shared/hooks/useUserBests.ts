// src/hooks/useBests.ts
import { useCallback, useEffect, useState } from "react";
import type { typePB } from "@/features/coach/types/coach";
import { apiGetBests, apiSaveBest } from "@/shared/api/bests";
import { formatHHMMSS } from "@/shared/utils/time";

const CANONICAL_DISTANCES = [400, 1000, 5000, 21097, 42195] as const;

export function useBests(userId: number) {
  const [bests, setBests] = useState<typePB[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetBests(userId);
      // doplň prázdne záznamy pre všetky vzdialenosti
      const map = new Map<number, typePB>(data.map((b) => [b.distance_m, b]));
      const normalized: typePB[] = CANONICAL_DISTANCES.map((d) => {
        const row = map.get(d);
        return (
          row ?? {
            distance_m: d,
            best_time_s: null,
            time_str: "",
            event_name: "",
            date: "",
          }
        );
      });
      // domácky doplň time_str ak prišlo len best_time_s
      normalized.forEach((b) => {
        if (!b.time_str && b.best_time_s != null)
          b.time_str = formatHHMMSS(b.best_time_s);
      });
      setBests(normalized);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load bests");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const save = useCallback(
    async (best: typePB) => {
      await apiSaveBest(userId, best);
      await load();
    },
    [userId, load]
  );

  return { bests, setBests, load, save, loading, error };
}
