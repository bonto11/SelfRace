// src/app/shared/components/widgets/WidgetMonthlySummary.tsx
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
const HAS_DIST = new Set(["run", "ride", "swim", "mixed"]);

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
  const maxTime = Math.max(1, ...sports.map((s) => s.total_time_s));

  return (
    <WidgetCard
      title={t("monthlySummary.widget.title")}
      tooltip={t("monthlySummary.widget.tooltip")}
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
        <div className="flex flex-col gap-2 text-left">
          <div className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
            {fmtTime(data.summary.total_time_s)}
          </div>
          <div className="text-xs" style={{ color: appColors.textSecondary }}>
            {data.summary.total_sessions} {t("monthlySummary.widget.sessions")}
            {data.summary.total_dist_m > 0 ? ` · ${fmtDist(data.summary.total_dist_m)}` : ""}
          </div>

          {/* šport = pruh podľa podielu času – vidno, čomu sa venuješ najviac */}
          <div className="space-y-1.5 mt-1">
            {sports.map(({ sport, total_time_s, total_dist_m }) => (
              <div key={sport}>
                <div className="flex items-center justify-between text-[11px] mb-0.5">
                  <span style={{ color: appColors.textSecondary }}>{t(`common.sports.${sport}` as any)}</span>
                  <span className="tabular-nums" style={{ color: appColors.textPrimary }}>
                    {fmtTime(total_time_s)}
                    {HAS_DIST.has(sport) && total_dist_m ? (
                      <span style={{ color: appColors.textMuted }}> · {fmtDist(total_dist_m)}</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: appColors.surfaceCardBorder }}>
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(total_time_s / maxTime) * 100}%`, background: SPORT_COLOR[sport] ?? appColors.chartOther }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
