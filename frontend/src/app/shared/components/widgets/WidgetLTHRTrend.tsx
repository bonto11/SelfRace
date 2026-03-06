// src/app/shared/components/widgets/WidgetLTHRTrend.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { usePerformanceData } from "@/app/features/performance/providers/PerformanceDataProvider";
import { fmtDate } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

type Props = { onOpenDetail?: () => void };

export default function WidgetLTHRTrend({ onOpenDetail }: Props) {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const { latestZones } = data;

  const lthr = latestZones?.z5_min; // Spodná hranica Z5 je LTHR
  const maxHr = latestZones?.hr_max;

  return (
    <WidgetCard
      title={t("performance.widget.lthr.title") || "Laktátový Prah (LTHR)"}
      tooltip={t("performance.widget.lthr.tooltip") || "Aktuálny laktátový prah (začiatok zóny 5)."}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent={appColors.brandPrimary}
      minH={160}
    >
      {loading && !latestZones ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{lthr || "—"}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.hr")}</span>
          </div>
          <div className={WIDGET_NOTE}>
            Max HR: <span className="font-bold">{maxHr || "—"}</span> bpm
          </div>
          <div className={[WIDGET_META_LABEL, "mt-2"].join(" ")}>
             {fmtDate(latestZones?.created_at ?? null)}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
