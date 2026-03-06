// src/features/performance/components/WidgetZonesPaces.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { CHART_HR, WIDGET_LOADING_CENTER, WIDGET_META_LABEL } from "@/app/shared/ui/tokens";
import { fmtDate } from "@/app/shared/utils/time";

type Props = { onOpenDetail?: () => void };

function formatPace(secPerKm?: number | null) {
  if (!secPerKm || secPerKm <= 0) return "—";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

export default function WidgetZonesPaces({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestPace } = data;

  const zColor = (z: number) => {
    const c = CHART_HR?.colors;
    if (!c) return "white";
    return [c.z1, c.z2, c.z3, c.z4, c.z5][z - 1];
  };

  return (
    <WidgetCard
      title={t("performance.widget.zonesPaces.title") || "Tempá v zónach"}
      tooltip={t("performance.widget.zonesPaces.tooltip") || "Odhadované tempá prislúchajúce tvojim tepovým zónam."}
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
        <div className="flex flex-col h-full justify-between mt-1">
          <div className="flex flex-col gap-1.5">
            {[
              { label: "Z1 Tempo", val: formatPace(latestPace?.z1_pace_s), c: zColor(1) },
              { label: "Z2 Tempo", val: formatPace(latestPace?.z2_pace_s), c: zColor(2) },
              { label: "Z3 Tempo", val: formatPace(latestPace?.z3_pace_s), c: zColor(3) },
              { label: "Z4 Tempo", val: formatPace(latestPace?.z4_pace_s), c: zColor(4) },
              { label: "Z5 Tempo", val: formatPace(latestPace?.z5_pace_s), c: zColor(5) },
            ].map((z, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full opacity-70" style={{ backgroundColor: z.c }} />
                  <span className="opacity-80 text-xs">{z.label}</span>
                </div>
                <div className="font-semibold tabular-nums text-white/90">{z.val}</div>
              </div>
            ))}
          </div>
          
          <div className={[WIDGET_META_LABEL, "mt-3 pt-2 border-t border-white/5"].join(" ")}>
            Vypočítané: {fmtDate(latestPace?.measured_at ?? null)}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
