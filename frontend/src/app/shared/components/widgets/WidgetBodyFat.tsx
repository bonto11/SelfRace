// src/app/shared/components/widgets/WidgetBodyFat.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { fmtDate } from "@/app/shared/utils/time";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_VALUE_UNIT,
  WIDGET_PLACEHOLDER,
  WIDGET_ROW_BETWEEN,
  WIDGET_BLOCK,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

function colorForLevel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete")) return appColors.stateAthletes;
  if (l.includes("fitness")) return appColors.stateFitness;
  if (l.includes("average")) return appColors.stateAverage;
  if (l.includes("essential")) return appColors.stateEssential;
  if (l.includes("obese")) return appColors.stateObese;
  return appColors.textMuted;
}

function classifyBodyFat(sex: "M" | "F", t: (key: any) => string, pct?: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const bands = getBodyFatBands(sex);
  const hit = bands.find(b => (b.min == null || pct >= b.min) && (b.max == null || pct <= b.max));
  if (!hit) return null;

  const lvlKey = hit.label.trim().toLowerCase();
  const localizedLabel = (t as any)(`common.levels.${lvlKey}`);

  return {
    label: localizedLabel === `common.levels.${lvlKey}` ? hit.label.trim() : localizedLabel,
    color: colorForLevel(hit.label),
  };
}

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  
  // Namiesto useEffectov ťaháme dáta z Providera
  const { data, loading } = usePerformanceData();
  const { bodyFatHistory, vo2History } = data; // vo2History drží info o pohlaví z profilu

  const rowsBE = bodyFatHistory || [];
  const lastBE = rowsBE.length ? rowsBE[rowsBE.length - 1] : null;

  const pct = typeof lastBE?.value_num === "number" ? lastBE.value_num : null;
  const updatedAt = lastBE?.measured_at ?? null;
  
  // Pohlavie pre pásma vytiahneme z profilu (zdieľané s VO2)
  const sex = vo2History?.sex === "F" ? "F" : "M";
  const level = classifyBodyFat(sex, t, pct);
  
  const accent = level?.color ?? appColors.brandPrimary;

  return (
    <WidgetCard
      title={t("bodyFat.widget.title")}
      tooltip={t("bodyFat.widget.tooltip")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accent}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading && rowsBE.length === 0 ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className={WIDGET_ROW_BETWEEN}>
          <div className={WIDGET_BLOCK}>
            <div className={WIDGET_META_LABEL}>
              {t("performance.metrics.measuredPlaceholder")} {fmtDate(updatedAt)}
            </div>

            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {pct != null ? pct.toFixed(1) : "—"}
                <span className={WIDGET_VALUE_UNIT}> {t("common.units.pct")}</span>
              </div>
              {level ? <Pill label={level.label} color={level.color} /> : <span className={WIDGET_PLACEHOLDER}>—</span>}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
