// src/app/shared/components/widgets/WidgetActivitiesWrapped.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

import {
  apiGetActivitiesWrappedStatus,
  type ActivitiesWrappedStatus,
} from "@/app/features/activities/api/activities_wrapped";
import { useT } from "@/app/shared/i18n/useT";

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
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(min)} min`;
}

// 🌟 NOVÉ: label/value riadok - rovnaká typografická logika ako Subcard v
// detaile (drobný uppercase label + tučná hodnota), len kompaktnejšie pre
// widget. Dáta idú pod sebou (jeden riadok = jedna metrika), nie zlepené do
// jedného odseku so "·" oddeľovačmi ako predtým.
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-[11px] font-medium uppercase tracking-wide"
        style={{ color: appColors.textMuted }}
      >
        {label}
      </span>
      <span
        className="text-sm font-bold whitespace-nowrap"
        style={{ color: appColors.textPrimary }}
      >
        {value}
      </span>
    </div>
  );
}

export default function WidgetActivitiesWrapped({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const [status, setStatus] = useState<ActivitiesWrappedStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useT();

  useEffect(() => {
    if (!userId || isChecking) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetActivitiesWrappedStatus(userId);
        if (alive) setStatus(r);
      } catch (e: any) {
        if (alive)
          setError(
            t(e?.message as any) ||
              t("activitiesWrapped.widget.errorFailedLoad" as any),
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, t, isChecking]);

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
      tooltip={t("activitiesWrapped.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
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
        <div className="flex flex-col gap-3">
          {status?.can_generate && (
            <div
              className="text-sm font-bold"
              style={{ color: appColors.statusSuccess }}
            >
              🎉 {t("activitiesWrapped.widget.newAvailable")}
            </div>
          )}

          {latest && (
            <div className="flex flex-col gap-2">
              <div
                className="text-sm font-bold leading-snug"
                style={{ color: appColors.textPrimary }}
              >
                {latest.title}
              </div>

              {/* 🌟 Jemný oddeľovač medzi nadpisom a dátami, len ak je nad
                  ním aj "nový dostupný" banner - inak by pôsobil zbytočne. */}
              <div
                className="flex flex-col gap-1.5 pt-1"
                style={{
                  borderTop: status?.can_generate
                    ? `1px solid ${appColors.divider}`
                    : undefined,
                }}
              >
                <StatRow
                  label={t("activitiesWrapped.stats.totalDistance" as any)}
                  value={`${latest.hard_stats.total_distance_km} km`}
                />
                <StatRow
                  label={t("activitiesWrapped.stats.totalTime" as any)}
                  value={formatMinutes(latest.hard_stats.total_time_min)}
                />
                <StatRow
                  label={t("activitiesWrapped.stats.count" as any)}
                  value={String(latest.hard_stats.count)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}