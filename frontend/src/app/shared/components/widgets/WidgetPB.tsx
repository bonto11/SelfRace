// src/features/widgets/WidgetPB.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/components/components/WidgetCard";
import { useFavoritePBRun } from "@/app/features/bests/hooks/useFavoritePBRun";
import { apiGetBests } from "@/app/features/bests/api/bests";

import { distanceLabel } from "@/app/features/bests/utils/bests";
import { type UserBest } from "@/app/features/bests/types/bests";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { secToHHMMSS } from "@/app/shared/utils/time";
import LoadingSpinner from "@/app/shared/components/components/LoadingSpinner";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_METRIC_VALUE,
  WIDGET_FOOTNOTE,
  WIDGET_EMPTY,
} from "@/app/shared/ui/tokens";

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
    () => (favM ? (rows.find((r) => r.distance_m === favM) ?? null) : null),
    [rows, favM]
  );

  const main =
    fav?.best_time_s != null
      ? secToHHMMSS(fav.best_time_s)
      : (fav?.time_str ?? "—");

  const sub = `Distance: ${favM ? distanceLabel(favM, "run") : "—"}`;

  const CH = (THEME as any)?.chart ?? {};
  const accent =
    CH.run ??
    CH.positive ??
    CH.fitness ??
    CH.neutral ??
    (THEME as any)?.accent?.primary ??
    appColors.brandPrimary;

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
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : fav ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className={WIDGET_METRIC_VALUE}>{main}</span>
          </div>
          <div className={WIDGET_FOOTNOTE}>{sub}</div>
        </>
      ) : (
        <div className={WIDGET_EMPTY}>
          Zatiaľ nemáš PB pre obľúbenú vzdialenosť.
          <br />
          Otvor detail a pridaj svoj rekord.
        </div>
      )}
    </WidgetCard>
  );
}
