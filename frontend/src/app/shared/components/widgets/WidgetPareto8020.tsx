// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { fmtMinutes } from "@/app/shared/utils/time";
import { sportsToCSV, normalizeSportList } from "@/app/configs/config_sports";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_CENTER,
  WIDGET_FOOTNOTE,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | string[] | null;
};

const TOOLTIP_8020 = [
  "80/20 (Pareto princíp) popisuje rozdelenie tréningovej intenzity:",
  "",
  "• cca 80 % času v nízkej intenzite (Easy, Z1–Z2)",
  "• cca 20 % času v strednej a vysokej intenzite (Z3+)",
  "",
  "Prečo to funguje:",
  "• väčšina vytrvalostných adaptácií vzniká v nízkej intenzite",
  "• vysoká intenzita je silný stimul, ale drahá na regeneráciu",
  "",
  "Ako to čítať:",
  "• mierna odchýlka od 80/20 je úplne normálna",
  "• dôležitý je trend v čase (nie jeden týždeň)",
  "",
  "Pozor:",
  "• 80/20 nie je dogma – v príprave na preteky môže byť pomer posunutý",
  "• problém je dlhodobo veľa hard dní bez dostatočného easy objemu",
].join("\n");

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
}: Props) {
  const { getParetoWidget } = useActivityData();

  const sportParam = useMemo(() => {
    if (sport == null) return null;
    if (Array.isArray(sport)) return sportsToCSV(sport);
    const s = String(sport).trim();
    if (!s || s.toLowerCase() === "all") return "all";
    const list = s.split(",").map((x) => x.trim()).filter(Boolean);
    return sportsToCSV(normalizeSportList(list));
  }, [sport]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getParetoWidget(7 * weeks, sportParam);
        if (!alive) return;
        setData(d ?? { easy_min: 0, hard_min: 0, total_min: 0, days: 7 * weeks });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getParetoWidget, weeks, sportParam]);

  const E = Math.max(0, Number(data?.easy_min ?? 0));
  const H = Math.max(0, Number(data?.hard_min ?? 0));
  const T = Math.max(0, E + H);

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = T ? 100 - easyPct : 0;

  const targetEasy = 0.8 * T;
  const deltaEasy = Math.round(targetEasy - E);

  const accent = T === 0 ? "none" : appColors.stateWarning;

  const note =
    T === 0
      ? ""
      : deltaEasy > 0
        ? `Chýba ti ${deltaEasy} min Easy do 80/20.`
        : deltaEasy < 0
          ? `Máš +${Math.abs(deltaEasy)} min Easy oproti 80/20.`
          : "Si presne na 80/20 ✔";

  return (
    <WidgetCard
      title={`Posledné ${weeks} týždne – 80/20`}
      tooltip={TOOLTIP_8020}
      onOpen={onOpenTrend}
      interactive={!!onOpenTrend}
      accent={accent}
      minH={200}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_CENTER}>
            {/* SVG prstenec ostáva nezmenený */}
            {/* … */}
          </div>

          <div className={WIDGET_FOOTNOTE}>
            Easy: {fmtMinutes(E)} ({easyPct}%) · Hard: {fmtMinutes(H)} ({hardPct}
            %){T ? <> · {fmtMinutes(T)} spolu</> : null}
          </div>

          {note && <div className={WIDGET_NOTE}>{note}</div>}
        </>
      )}
    </WidgetCard>
  );
}