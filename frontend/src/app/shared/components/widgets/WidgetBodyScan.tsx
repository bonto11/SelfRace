// src/shared/components/widgets/WidgetBodyScan.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { fmtDate } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_VALUE_UNIT,
  WIDGET_PLACEHOLDER,
} from "@/app/shared/ui/tokens";
import { apiGetLatestBodyScan } from "@/app/features/performance/api/bodyScan";
import type { BodyScan } from "@/app/features/performance/types/bodyScan";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

function scoreColor(score: number | null): string {
  if (score == null) return appColors.brandPrimary;
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#facc15";
  return "#f97316";
}

export default function WidgetBodyScan({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { userId } = useUserId();

  const [scan, setScan] = React.useState<BodyScan | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetLatestBodyScan(Number(userId))
      .then((s) => {
        if (alive) setScan(s);
      })
      .catch((e) => console.error("[WidgetBodyScan]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const score = scan?.inbody_score ?? null;
  const weight = scan?.weight_kg ?? null;
  const pbf = scan?.pbf_percent ?? null;
  const skeletalMuscle = scan?.skeletal_muscle_mass_kg ?? null;
  const updatedAt = scan?.scan_date ?? null;

  const accent = scoreColor(score);

  return (
    <WidgetCard
      title={t("bodyScan.widget.title")}
      tooltip={t("bodyScan.widget.tooltip")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accent}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : !scan ? (
        <div className="flex flex-col items-center justify-center h-full gap-1 text-center">
          <span className={WIDGET_PLACEHOLDER}>{t("bodyScan.widget.empty")}</span>
        </div>
      ) : (
        <div className="flex flex-col h-full justify-between mt-1">
          <div className={WIDGET_META_LABEL}>
            {t("performance.metrics.measuredPlaceholder")} {fmtDate(updatedAt)}
          </div>

          <div className={WIDGET_VALUE_ROW}>
            <div className={WIDGET_VALUE_MAIN} style={{ color: accent }}>
              {score != null ? score : "—"}
              <span className={WIDGET_VALUE_UNIT} style={{ color: accent }}>
                {" "}
                /100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-y-2 gap-x-2 mt-2 pt-2 border-t border-white/5">
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">
                {t("common.units.kg")}
              </div>
              <div className="text-sm font-bold tracking-tight text-white/90 tabular-nums">
                {weight != null ? weight.toFixed(1) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">
                {t("bodyScan.widget.pbf")}
              </div>
              <div className="text-sm font-bold tracking-tight text-white/90 tabular-nums">
                {pbf != null ? `${pbf.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold opacity-50 tracking-wider mb-0.5">
                {t("bodyScan.widget.smm")}
              </div>
              <div className="text-sm font-bold tracking-tight text-white/90 tabular-nums">
                {skeletalMuscle != null ? `${skeletalMuscle.toFixed(1)}` : "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}