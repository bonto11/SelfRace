// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  useActivityData,
  PARETO_DEFAULT_DAYS,
} from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { fmtMinutes } from "@/app/shared/utils/time";
import { sportsToCSV, normalizeSportList } from "@/app/configs/config_sports";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_CENTER,
  WIDGET_NOTE,
  WIDGET_EMPTY_TEXT,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

import { LegendRow, SplitBar, StatusChip, type Tone } from "@/app/shared/components/widgets/parts/WidgetParts";

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
  const { getParetoWidget, pareto2w } = useActivityData();
  const t = useT();

  const sportParam = useMemo(() => {
    if (sport == null) return null;
    if (Array.isArray(sport)) return sportsToCSV(sport);
    const s = String(sport).trim();
    if (!s || s.toLowerCase() === "all") return "all";
    const list = s.split(",").map((x) => x.trim()).filter(Boolean);
    return sportsToCSV(normalizeSportList(list));
  }, [sport]);

  // predvolený rozsah (2 týždne, všetky športy) drží provider v cache,
  // iné kombinácie si widget načíta sám
  const useShared = 7 * weeks === PARETO_DEFAULT_DAYS && sportParam == null;

  useEffect(() => {
    if (useShared) pareto2w.ensure();
  }, [useShared, pareto2w.ensure]);

  const [ownLoading, setOwnLoading] = useState(false);
  const [ownData, setOwnData] = useState<{
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  } | null>(null);

  useEffect(() => {
    if (useShared) return;
    let alive = true;
    (async () => {
      setOwnLoading(true);
      try {
        const d = await getParetoWidget(7 * weeks, sportParam);
        if (!alive) return;
        setOwnData(d ?? { easy_min: 0, hard_min: 0, total_min: 0, days: 7 * weeks });
      } finally {
        if (alive) setOwnLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [useShared, getParetoWidget, weeks, sportParam]);

  const loading = useShared ? !pareto2w.loaded : ownLoading;
  const data = useShared
    ? pareto2w.data ?? { easy_min: 0, hard_min: 0, total_min: 0, days: 7 * weeks }
    : ownData;

  const E = Math.max(0, Number(data?.easy_min ?? 0));
  const H = Math.max(0, Number(data?.hard_min ?? 0));
  const T = Math.max(0, E + H);

  const targetEasy = 0.8 * T;
  const deltaEasy = Math.round(targetEasy - E);

  // Ak sú dáta prázdne, nezvýrazňujeme widget

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

  const widgetTitle = t("pareto8020.widget.title").replace("{{weeks}}", String(weeks));
  const easyPct = T ? Math.round((E / T) * 100) : 0;
  // od 75 % ľahkej záťaže je mix v poriadku (rovnako ako v trende 80/20)
  const tone: Tone = easyPct >= 75 ? "good" : easyPct >= 65 ? "warn" : "danger";
  const C = { easy: appColors.chartRecoveryMain, hard: appColors.chartRecoveryAlt };
  const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;

  return (
    <WidgetCard
      title={widgetTitle}
      tooltip={t("pareto8020.widget.tooltip")}
      onOpen={onOpenTrend}
      interactive={!!onOpenTrend}
      accent={T === 0 || tone === "good" ? "none" : appColors.statusWarning}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : T === 0 ? (
        <div className={WIDGET_EMPTY_TEXT}>{t("common.noData")}</div>
      ) : (
        <div className="flex flex-col gap-2 text-left">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
              {easyPct}
            </span>
            <span className="text-base" style={{ color: appColors.textSecondary }}>%</span>
            <span className="text-xs" style={{ color: appColors.textSecondary }}>
              {t("activityWidgets.easyShare")}
            </span>
          </div>
          <SplitBar a={E} b={H} colorA={C.easy} colorB={C.hard} targetPct={80} />
          <div className="text-[10px] text-right -mt-0.5" style={{ color: appColors.textMuted }}>
            {t("activityWidgets.target80")}
          </div>
          <div className="space-y-1">
            <LegendRow color={C.easy} label={t("pareto8020.trend.labelEasy")} value={hm(E)} />
            <LegendRow color={C.hard} label={t("pareto8020.trend.labelHard")} value={hm(H)} />
          </div>
          {note ? <StatusChip tone={tone} label={note} /> : null}
        </div>
      )}
    </WidgetCard>
  );
}
