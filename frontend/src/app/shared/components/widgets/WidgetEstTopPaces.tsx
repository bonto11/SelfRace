// src/features/performance/components/WidgetEstTopPaces.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import { fmtDate } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_MAIN,
} from "@/app/shared/ui/tokens";

type Props = { onOpenDetail?: () => void };

function formatRaceTime(minutes?: number | null) {
  if (!minutes || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes % 1) * 60);
  
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WidgetEstTopPaces({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestPace } = data;

  return (
    <WidgetCard
      title={t("performance.widget.estPaces.title") || "Odhadované preteky"}
      tooltip={t("performance.widget.estPaces.tooltip") || "Odhady tvojich maximálnych výkonov na pretekoch."}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={168}
    >
      {loading && !latestPace ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between mt-2">
          {/* 2x2 Grid pre preteky */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">5 km</div>
              <div className={WIDGET_VALUE_MAIN}>{formatRaceTime(latestPace?.est_5k_time_min)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">10 km</div>
              <div className={WIDGET_VALUE_MAIN}>{formatRaceTime(latestPace?.est_10k_time_min)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">Polmaratón</div>
              <div className="text-xl font-bold tracking-tight text-white/90 tabular-nums leading-none">
                {formatRaceTime(latestPace?.est_21k_time_min)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">Maratón</div>
              <div className="text-xl font-bold tracking-tight text-white/90 tabular-nums leading-none">
                {formatRaceTime(latestPace?.est_42k_time_min)}
              </div>
            </div>
          </div>
          
          <div className={[WIDGET_META_LABEL, "mt-3 pt-2 border-t border-white/5"].join(" ")}>
            Odhad k: {fmtDate(latestPace?.measured_at ?? null)}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
