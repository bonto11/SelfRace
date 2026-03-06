// src/features/performance/components/WidgetZonesHR.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { CHART_HR, WIDGET_LOADING_CENTER, WIDGET_META_LABEL } from "@/app/shared/ui/tokens";
import { fmtDate } from "@/app/shared/utils/time";

type Props = { onOpenDetail?: () => void };

export default function WidgetZonesHR({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestZones } = data;

  const zColor = (z: number) => {
    const c = CHART_HR?.colors;
    if (!c) return "white";
    return [c.z1, c.z2, c.z3, c.z4, c.z5][z - 1];
  };

  return (
    <WidgetCard
      title={t("performance.widget.zonesHr.title") || "Tepové zóny"}
      tooltip={t("performance.widget.zonesHr.tooltip") || "Aktuálne nastavenie tvojich tréningových zón (HR)."}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={168}
    >
      {loading && !latestZones ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between mt-1">
          <div className="flex flex-col gap-1.5">
            {[
              { label: "Z1 (Regenerácia)", val: `< ${latestZones?.z1_max || "—"}`, c: zColor(1) },
              { label: "Z2 (Vytrvalosť)", val: `${latestZones?.z2_min || "—"} - ${latestZones?.z2_max || "—"}`, c: zColor(2) },
              { label: "Z3 (Tempo)", val: `${latestZones?.z3_min || "—"} - ${latestZones?.z3_max || "—"}`, c: zColor(3) },
              { label: "Z4 (Prah)", val: `${latestZones?.z4_min || "—"} - ${latestZones?.z4_max || "—"}`, c: zColor(4) },
              { label: "Z5 (Maximum)", val: `> ${latestZones?.z5_min || "—"}`, c: zColor(5) },
            ].map((z, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: z.c }} />
                  <span className="opacity-80 text-xs">{z.label}</span>
                </div>
                <div className="font-semibold tabular-nums text-white/90">{z.val}</div>
              </div>
            ))}
          </div>
          
          <div className={[WIDGET_META_LABEL, "mt-3 pt-2 border-t border-white/5"].join(" ")}>
            Aktualizované: {fmtDate(latestZones?.created_at ?? null)}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
