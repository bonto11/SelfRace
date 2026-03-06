"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useFavoritePBRun } from "@/app/features/bests/hooks/useFavoritePBRun";
import { apiGetBests } from "@/app/features/bests/api/bests";

import { distanceLabel } from "@/app/features/bests/utils/bests";
import { type UserBest } from "@/app/features/bests/types/bests";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { secToHHMMSS } from "@/app/shared/utils/time";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_METRIC_VALUE,
  WIDGET_FOOTNOTE,
  WIDGET_EMPTY,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function WidgetPB({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const { favM } = useFavoritePBRun();
  const t = useT();

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
      } catch (e: any) {
         console.error("[WidgetPB] load failed:", t(e?.message as any));
         if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

  const fav = useMemo(
    () => (favM ? rows.find((r) => r.distance_m === favM) ?? null : null),
    [rows, favM],
  );

  // Formátovanie hlavného času rekordu
  const mainValue =
    fav?.best_time_s != null
      ? secToHHMMSS(fav.best_time_s)
      : fav?.time_str ?? "—";

  // Výpočet tempa pre konkrétny rekord (segment)
  const recordPace = useMemo(() => {
    if (!fav?.best_time_s || !fav?.distance_m) return null;
    const secondsPerKm = fav.best_time_s / (fav.distance_m / 1000);
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [fav]);

  // Formátovanie celkových informácií o aktivite (celý beh)
  const totalActivityInfo = useMemo(() => {
    // Predpokladáme, že UserBest obsahuje aj dáta o pôvodnej aktivite
    const distM = fav?.total_distance_m;
    const timeS = fav?.total_time_s;
    if (!distM || !timeS) return null;

    const distKm = (distM / 1000).toFixed(2);
    const timeStr = secToHHMMSS(timeS);
    const paceSecPerKm = timeS / (distM / 1000);
    const pMins = Math.floor(paceSecPerKm / 60);
    const pSecs = Math.round(paceSecPerKm % 60);
    const paceStr = `${pMins}:${pSecs.toString().padStart(2, "0")}`;

    return `${distKm} km • ${timeStr} • ${paceStr}/km`;
  }, [fav]);

  const subLabel = `${t("PB.widget.distanceLabel")}: ${favM ? distanceLabel(favM, "run") : "—"}`;

  return (
    <WidgetCard
      title={t("PB.widget.title")}
      tooltip={t("PB.widget.tooltip")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : fav ? (
        <div className="flex flex-col h-full justify-between py-1">
          {/* HLAVNÝ BLOK REKORDU */}
          <div className="flex flex-col gap-0">
            <div className={WIDGET_METRIC_VALUE}>{mainValue}</div>
            {recordPace && (
              <div className="text-lg font-bold opacity-90 -mt-1">
                {recordPace} <span className="text-xs opacity-50 font-normal">/km</span>
              </div>
            )}
            <div className={[WIDGET_FOOTNOTE, "mt-1"].join(" ")}>{subLabel}</div>
          </div>

          {/* BLOK CELKOVEJ AKTIVITY */}
          {totalActivityInfo && (
            <div className="mt-4 pt-2 border-t border-white/5">
              <div className={[WIDGET_FOOTNOTE, "opacity-40"].join(" ")}>
                {t("PB.widget.totalActivity") || "Celý beh"}:
              </div>
              <div className={[WIDGET_FOOTNOTE, "opacity-60 font-medium"].join(" ")}>
                {totalActivityInfo}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={WIDGET_EMPTY}>
          {t("PB.widget.empty")}
        </div>
      )}
    </WidgetCard>
  );
}
