// src/app/shared/components/widgets/WidgetActivitiesWrapped.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_SUB,
  WIDGET_INFO_TEXT,
} from "@/app/shared/ui/tokens";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useT } from "@/app/shared/i18n/useT";
import { Sparkles } from "lucide-react";
import { IconTile, MiniStat, Pill } from "@/app/shared/components/widgets/parts/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

type Props = {
  onOpenDetail?: () => void;
};

// 🌟 Rovnaká logika ako v detaile — widget zámerne NEUKAZUJE pace/rýchlosť
// (miešanie behu a bicykla nedáva zmysel), len hodnoty, ktoré sú medzi
// športmi porovnateľné a dajú sa sčítať: vzdialenosť, čas, počet.
function formatMinutes(min: number | null): string {
  if (!min || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    // nad 10 h stačia hodiny – minúty by sa do malej dlaždice nezmestili
    if (h >= 10) return `${Math.round(min / 60)} h`;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(min)} min`;
}

export default function WidgetActivitiesWrapped({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const t = useT();

  const { wrappedStatus } = useActivityData();
  useEnsure(wrappedStatus);
  const status = wrappedStatus.data ?? null;
  const loading = !wrappedStatus.loaded;
  const error =
    wrappedStatus.error && wrappedStatus.data === undefined
      ? t("activitiesWrapped.widget.errorFailedLoad" as any)
      : null;

  const accent = useMemo(() => {
    if (status?.can_generate) return appColors.statusSuccess;
    return "none";
  }, [status]);

  const latest = status?.history?.[0] ?? null;

  // Widget sa nevykreslí vôbec, ak feature nie je pre usera povolená
  // (can_generate=false) A zároveň nemá žiadnu históriu.
  if (
    !loading &&
    !isChecking &&
    !error &&
    userId &&
    !status?.can_generate &&
    !latest
  ) {
    return null;
  }

  return (
    <WidgetCard
      title={t("activitiesWrapped.widget.title")}
      tooltip={activityInfo(t, "wrapped")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading || isChecking ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>{t("widget.missingUserId")}</div>
      ) : (
        <div className="flex flex-col gap-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <IconTile icon={Sparkles} color={appColors.chartRecoveryMain} />
              <div
                className="text-sm font-bold leading-snug line-clamp-2"
                style={{ color: appColors.textPrimary }}
              >
                {latest?.title ?? t("activitiesWrapped.widget.newAvailable")}
              </div>
            </div>
            {status?.can_generate && latest ? (
              <Pill tone="good" icon={Sparkles} label={t("activityWidgets.newWrapped")} />
            ) : null}
          </div>

          {latest ? (
            <div className="grid grid-cols-3 gap-2">
              <MiniStat
                value={`${latest.hard_stats.total_distance_km} km`}
                label={t("activityWidgets.statDist")}
              />
              <MiniStat
                value={formatMinutes(latest.hard_stats.total_time_min)}
                label={t("activityWidgets.statTime")}
              />
              <MiniStat
                value={String(latest.hard_stats.count)}
                label={t("activityWidgets.statCount")}
              />
            </div>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
