// src/app/shared/components/widgets/WidgetEstTimes.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import { fmtDate } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";

import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
} from "@/app/shared/ui/tokens";

type Props = { onOpenDetail?: () => void };

// Helper pre zobrazenie minút do formátu hh:mm:ss alebo mm:ss
function formatPaceTime(minutes?: number | null) {
  if (!minutes || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WidgetEstTimes({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestPace } = data;

  return (
    <WidgetCard
      title={t("performance.widget.estTimes.title") || "Odhadované časy"}
      tooltip={t("performance.widget.estTimes.tooltip") || "Odhady na základe AI analýzy tvojich maximálnych výkonov."}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading && !latestPace ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider mb-1">5 km</div>
              <div className={WIDGET_VALUE_MAIN}>{formatPaceTime(latestPace?.est_5k_time_min)}</div>
            </div>
            <div>
              <div className="text-xs uppercase font-bold opacity-50 tracking-wider mb-1">10 km</div>
              <div className={WIDGET_VALUE_MAIN}>{formatPaceTime(latestPace?.est_10k_time_min)}</div>
            </div>
          </div>
          
          <div className={[WIDGET_META_LABEL, "mt-4 pt-3 border-t border-white/5"].join(" ")}>
            {t("performance.metrics.measuredPlaceholder")} {fmtDate(latestPace?.measured_at ?? null)}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
