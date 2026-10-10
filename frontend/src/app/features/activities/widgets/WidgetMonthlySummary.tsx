"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { appLocale, normalizeLang } from "@/app/shared/i18n/locale";
import { Caption, Dot, Hero, StackBar, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";
import { STRENGTH_CATALOG_FE } from "@/app/features/strength/constants/strengthCatalog";
import { exerciseBest } from "@/app/features/activities/utils/strengthMonth";
import { WK } from "@/app/shared/ui/tokens/widgets";

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
  const { lang: appLang } = useSettings();
  const lang = (normalizeLang(appLang) ?? "en") as "sk" | "cs" | "en";
  const { monthlySummary } = useActivityData();
  useEnsure(monthlySummary);

  const loading = !monthlySummary.loaded;
  const data = monthlySummary.data ?? null;

  const sports = SPORT_ORDER
    .filter((s) => data?.sport_stats[s] && data.sport_stats[s].total_time_s > 0)
    .map((s) => ({ sport: s, ...data!.sport_stats[s] }));
  // do legendy len 3 najväčšie – viac by widget preplnilo, celý rozpis je v detaile
  const top = [...sports].sort((a, b) => b.total_time_s - a.total_time_s).slice(0, 3);

  // len ručné silové zápisy (bez Stravy) nemajú čas – hlavné číslo sú tréningy
  const strength = data?.strength ?? null;
  const hasTime = (data?.summary.total_time_s ?? 0) > 0;
  const exName = (id: string, fallback: string) => STRENGTH_CATALOG_FE[id]?.[lang] ?? fallback;
  const strengthSub = strength
    ? strength.volume_kg > 0
      ? fmt(t("monthlySummary.widget.strengthSub"), {
          sets: strength.work_sets,
          volume: strength.volume_kg.toLocaleString(appLocale()),
        })
      : `${strength.work_sets} ${t("monthlySummary.strength.sets")}`
    : undefined;

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
        <WidgetLoading />
      ) : !data || data.summary.total_sessions === 0 ? (
        <p className="text-sm" style={{ color: appColors.textMuted }}>
          {t("monthlySummary.noData")}
        </p>
      ) : !hasTime && strength ? (
        <div className={WK.stack}>
          <Hero value={data.summary.total_sessions} unit={t("monthlySummary.widget.sessions")} sub={strengthSub} />
          <div className="flex flex-col gap-1">
            {strength.exercises.slice(0, 3).map((ex) => (
              <Dot
                key={ex.exercise_id}
                color={appColors.chartStrength}
                label={exName(ex.exercise_id, ex.name)}
                value={exerciseBest(ex, t("monthlySummary.strength.reps"))}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={WK.stack}>
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
          {strength ? (
            <Caption>
              {fmt(t("monthlySummary.widget.strengthLine"), { n: strength.sessions, sets: strength.work_sets })}
            </Caption>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
