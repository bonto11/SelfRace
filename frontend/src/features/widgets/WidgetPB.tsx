// src/features/widgets/WidgetPB.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useFavoritePBRun } from "@/shared/hooks/useFavoritePBRun";
import { distanceLabel, getBests, type UserBest } from "@/shared/api/bests";
import { useUserId } from "@/shared/hooks/useUserId";
import { secToHHMMSS } from "@/shared/utils/time";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

export default function WidgetPB({
  onOpenDetail, // -> /coach/pb
}: {
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const { favM } = useFavoritePBRun();
  const [rows, setRows] = useState<UserBest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        setRows(await getBests(userId, "run"));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const fav = useMemo(
    () => rows.find((r) => r.distance_m === favM) ?? null,
    [rows, favM]
  );

  const main =
    fav?.best_time_s != null
      ? secToHHMMSS(fav.best_time_s)
      : fav?.time_str ?? "—";

  const sub = `Distance: ${favM ? distanceLabel(favM, "run") : "—"}`;

  return (
    <WidgetCard
      title="Personal Bests — Run"
      note="TAP pre detail a úpravy rekordov."
      accent="bg-emerald-600"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold leading-none tabular-nums">
              {main}
            </span>
          </div>
          <div className="mt-1 text-xs opacity-80">{sub}</div>
        </>
      )}
    </WidgetCard>
  );
}