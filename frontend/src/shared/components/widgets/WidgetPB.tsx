// src/features/widgets/WidgetPB.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useFavoritePBRun } from "@/features/bests/hooks/useFavoritePBRun";
import {
  distanceLabel,
  apiGetBests,
  type UserBest,
} from "@/features/bests/api/bests";
import { useUserId } from "@/shared/hooks/useUserId";
import { secToHHMMSS } from "@/shared/utils/time";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { THEME } from "@/shared/theme/tokens";

export default function WidgetPB({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const { favM } = useFavoritePBRun();

  const [rows, setRows] = useState<UserBest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await apiGetBests(userId, "run");
        if (alive) setRows(Array.isArray(r) ? r : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const fav = useMemo(
    () => (favM ? rows.find((r) => r.distance_m === favM) ?? null : null),
    [rows, favM]
  );

  const main =
    fav?.best_time_s != null
      ? secToHHMMSS(fav.best_time_s)
      : fav?.time_str ?? "—";

  const sub = `Distance: ${favM ? distanceLabel(favM, "run") : "—"}`;

  // farby z témy (fallback na neutrál, ak by chýbali tokens)
  const accent = THEME?.chart?.run ?? THEME?.chart?.positive ?? "#10B981";

  return (
    <WidgetCard
      title="Personal Bests — Run"
      note="TAP pre detail a úpravy rekordov."
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : fav ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {main}
            </span>
          </div>
          <div className="mt-1 text-xs opacity-80">{sub}</div>
        </>
      ) : (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš PB pre obľúbenú vzdialenosť.
          <br />
          Otvor detail a pridaj svoj rekord.
        </div>
      )}
    </WidgetCard>
  );
}
