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
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

// Importujeme náš PieTrend komponent
import { PieTrend, type PieTrendItem } from "@/app/shared/components/trend/PieTrend";

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | string[] | null;
};

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
}: Props) {
  const { getParetoWidget } = useActivityData();
  const t = useT();

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
    return () => { alive = false; };
  }, [getParetoWidget, weeks, sportParam]);

  const E = Math.max(0, Number(data?.easy_min ?? 0));
  const H = Math.max(0, Number(data?.hard_min ?? 0));
  const T = Math.max(0, E + H);

  const targetEasy = 0.8 * T;
  const deltaEasy = Math.round(targetEasy - E);

  const accent = T === 0 ? "none" : appColors.stateWarning;

  const note = useMemo(() => {
    if (T === 0) return "";
    if (deltaEasy > 0) {
      return t("pareto8020.widget.noteMissing").replace("{{min}}", String(deltaEasy));
    }
    if (deltaEasy < 0) {
      return t("pareto8020.widget.noteExtra").replace("{{min}}", String(Math.abs(deltaEasy)));
    }
    return t("pareto8020.widget.notePerfect");
  }, [T, deltaEasy, t]);

  const widgetTitle = t("pareto8020.widget.title")
    .replace("{{weeks}}", String(weeks));

  // Príprava dát pre PieTrend graf
  const pieItems: PieTrendItem[] = useMemo(() => {
    return [
      {
        value: E,
        label: t("pareto8020.zone.easy"), // Uistite sa, že tento kľúč máte v slovníku (napr. "Easy")
        color: "#22c55e", // Zelená (môžete nahradiť za appColors...)
      },
      {
        value: H,
        label: t("pareto8020.zone.hard"), // Uistite sa, že tento kľúč máte v slovníku (napr. "Hard")
        color: "#ef4444", // Červená (môžete nahradiť za appColors...)
      },
    ];
  }, [E, H, t]);

  return (
    <WidgetCard
      title={widgetTitle}
      tooltip={t("pareto8020.widget.tooltip")}
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
            <PieTrend
              items={pieItems}
              valueFormatter={fmtMinutes}
              // Vykreslíme celkový čas pekne do stredu prstenca
              renderCenter={(total) => (
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-xs opacity-60 mb-0.5">{t("common.together")}</span>
                  <span className="font-bold text-[11px]">{fmtMinutes(total)}</span>
                </div>
              )}
            />
          </div>

          {/* WIDGET_FOOTNOTE som odstránil, pretože PieTrend si tvorí vlastnú legendu */}

          {note && <div className={WIDGET_NOTE}>{note}</div>}
        </>
      )}
    </WidgetCard>
  );
}
