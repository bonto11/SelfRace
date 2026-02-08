// src/features/widgets/WidgetPB.tsx
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

const TOOLTIP_PB = [
  "Tento widget zobrazuje tvoj osobný rekord (PB – Personal Best) pre vybranú / obľúbenú vzdialenosť.",
  "",
  "Ako to funguje:",
  "• vyberie sa tvoja preferovaná vzdialenosť (napr. 5 km, 10 km, polmaratón)",
  "• zobrazí sa najlepší zaznamenaný čas pre túto vzdialenosť",
  "",
  "Prečo je to užitočné:",
  "• PB je referenčný bod pre dlhodobý progres – nie každé zlepšenie musí byť PB",
  "• pomáha pri nastavovaní tempa (race pace, threshold, intervaly)",
  "• dáva kontext: tréning nemusí smerovať k PB každý mesiac",
  "",
  "Tip:",
  "• ak dlhšie PB nepadá, ale cítiš sa silnejší → často sa zlepšuje konzistencia, odolnosť a forma",
  "• PB má zmysel hodnotiť v kontexte sezóny, nie izolovane",
].join("\n");

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
    [rows, favM],
  );

  const main =
    fav?.best_time_s != null
      ? secToHHMMSS(fav.best_time_s)
      : fav?.time_str ?? "—";

  const sub = `Distance: ${favM ? distanceLabel(favM, "run") : "—"}`;

  return (
    <WidgetCard
      title="Osobné rekordy"
      tooltip={TOOLTIP_PB}
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