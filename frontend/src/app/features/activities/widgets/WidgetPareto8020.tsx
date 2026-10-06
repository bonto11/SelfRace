"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  useActivityData,
  PARETO_DEFAULT_DAYS,
} from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { sportsToCSV, normalizeSportList } from "@/app/configs/config_sports";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP, WIDGET_EMPTY_TEXT } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

import { Dot, Hero, Pill, StackBar, type Tone } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

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

  const widgetTitle = t("pareto8020.widget.title").replace("{{weeks}}", String(weeks));
  const easyPct = T ? Math.round((E / T) * 100) : 0;
  // od 75 % ľahkej záťaže je mix v poriadku (rovnako ako v trende 80/20)
  const tone: Tone = easyPct >= 75 ? "good" : easyPct >= 65 ? "warn" : "danger";
  const C = { easy: appColors.chartRecoveryMain, hard: appColors.chartRecoveryAlt };
  const hm = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} min`;

  return (
    <WidgetCard
      title={widgetTitle}
      tooltip={activityInfo(t, "pareto")}
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
        <div className="flex flex-col gap-3 text-left">
          <Hero
            value={easyPct}
            unit="%"
            sub={t("activityWidgets.easyShare")}
            right={
              <Pill
                tone={tone}
                label={
                  tone === "danger"
                    ? t("activityWidgets.tone.danger")
                    : tone === "warn"
                      ? t("activityWidgets.tone.warn")
                      : t("activityWidgets.tone.good")
                }
              />
            }
          />
          <StackBar
            parts={[
              { value: E, color: C.easy },
              { value: H, color: C.hard },
            ]}
            targetPct={80}
          />
          <div className="flex items-center justify-between gap-2">
            <Dot color={C.easy} label={t("activityWidgets.easy")} value={hm(E)} />
            <Dot color={C.hard} label={t("activityWidgets.hard")} value={hm(H)} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
