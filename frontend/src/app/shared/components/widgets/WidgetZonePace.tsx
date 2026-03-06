// src/app/shared/components/widgets/WidgetZonePace.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

type Props = { onOpenDetail?: () => void };

function formatPace(secPerKm?: number | null) {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WidgetZonePace({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestPace } = data;

  const paceZ2 = latestPace?.z2_pace_s;

  return (
    <WidgetCard
      title={t("performance.widget.zonePace.title") || "Aeróbna Efektivita"}
      tooltip={t("performance.widget.zonePace.tooltip") || "Priemerné tempo na hornej hranici tvojej Zóny 2."}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {loading && !latestPace ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className="text-xs font-bold opacity-60 uppercase mb-1">Tempo v Zóne 2</div>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{formatPace(paceZ2)}</span>
            <span className={WIDGET_VALUE_UNIT}>/km</span>
          </div>
          <p className={WIDGET_NOTE}>
            {t("performance.widget.zonePace.note") || "Odhadovaná rýchlosť pre tvoje základné vytrvalostné behy."}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
