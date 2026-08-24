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
  WIDGET_SUMMARY_TEXT,
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
  if (!loading && !isChecking && !error && userId && !status?.can_generate && !latest) {
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
        <div className="flex flex-col gap-2">
          {/* 🌟 FIX: banner "nový súhrn dostupný" a posledné vygenerované
              dáta sa už NEVYLUČUJÚ navzájom (predtým bola len jedna ALEBO
              druhá vetva) - ak je aktívny trigger AJ existuje história,
              zobrazí sa oboje naraz. Athlete tak vidí "máš nový k dispozícii"
              a zároveň naposledy vygenerované čísla, nie jedno na úkor
              druhého. */}
          {status?.can_generate && (
            <div
              className="text-sm font-bold"
              style={{ color: appColors.statusSuccess }}
            >
              🎉 {t("activitiesWrapped.widget.newAvailable")}
            </div>
          )}
          {latest && (
            <div>
              <div className="text-xs opacity-60 mb-1">{latest.title}</div>
              <p className={WIDGET_SUMMARY_TEXT}>
                {latest.hard_stats.total_distance_km} km ·{" "}
                {formatMinutes(latest.hard_stats.total_time_min)} ·{" "}
                {latest.hard_stats.count}{" "}
                {t("activitiesWrapped.stats.count" as any).toLowerCase()}
              </p>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}