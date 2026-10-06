"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { Dot, Hero, StackBar } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}
function fmtDist(meters: number): string {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

const SPORT_ORDER = ["run", "ride", "swim", "mixed", "strength", "walk", "other"];
const SPORT_COLOR: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  mixed: appColors.chartMixed,
  strength: appColors.chartStrength,
  walk: appColors.chartWalk,
  other: appColors.chartOther,
};

/* ─── WIDGET ─── */
export default function WidgetMonthlySummary({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const t = useT();
  const { monthlySummary } = useActivityData();
  useEnsure(monthlySummary);

  const loading = !monthlySummary.loaded;
  const data = monthlySummary.data ?? null;

  const sports = SPORT_ORDER
    .filter((s) => data?.sport_stats[s] && data.sport_stats[s].total_time_s > 0)
    .map((s) => ({ sport: s, ...data!.sport_stats[s] }));
  // do legendy len 3 najväčšie – viac by widget preplnilo, celý rozpis je v detaile
  const top = [...sports].sort((a, b) => b.total_time_s - a.total_time_s).slice(0, 3);

  return (
    <WidgetCard
      title={t("monthlySummary.widget.title")}
      tooltip={activityInfo(t, "monthly")}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : !data || data.summary.total_sessions === 0 ? (
        <p className="text-sm" style={{ color: appColors.textMuted }}>
          {t("monthlySummary.noData")}
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-left">
          <Hero
            value={fmtTime(data.summary.total_time_s)}
            sub={`${data.summary.total_sessions} ${t("monthlySummary.widget.sessions")}${
              data.summary.total_dist_m > 0 ? ` · ${fmtDist(data.summary.total_dist_m)}` : ""
            }`}
          />
          <StackBar
            parts={sports.map((s) => ({ value: s.total_time_s, color: SPORT_COLOR[s.sport] ?? appColors.chartOther }))}
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {top.map(({ sport, total_time_s }) => (
              <Dot
                key={sport}
                color={SPORT_COLOR[sport] ?? appColors.chartOther}
                label={t(`common.sports.${sport}` as any)}
                value={fmtTime(total_time_s)}
              />
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
