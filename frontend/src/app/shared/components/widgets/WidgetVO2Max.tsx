// src/app/shared/components/widgets/WidgetVO2Max.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { fmtDate } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";

import {
  NO_X_OVERFLOW,
  WIDGET_LOADING_CENTER,
  WIDGET_META_LABEL,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_MAIN,
  WIDGET_PLACEHOLDER,
  WIDGET_VALUE_UNIT,
} from "@/app/shared/ui/tokens";

import type { Group } from "@/app/features/performance/types/performance";
import { levelColor } from "@/app/features/performance/utils/performance";

// 👈 Pridaný showAdvanced do Props
type Props = { 
  onOpen?: () => void; 
  onOpenDetail?: () => void;
  showAdvanced?: boolean; 
};

export default function WidgetVO2Max({ onOpen, onOpenDetail, showAdvanced = false }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  
  const { data, loading } = usePerformanceData();
  const { vo2MeasuredLatest, vo2EstimatedLatest } = data;

  const mVO2 = vo2MeasuredLatest?.value ?? null;
  const measuredDate = vo2MeasuredLatest?.measured_at ?? null;

  const sex = vo2MeasuredLatest?.sex === "F" ? "F" : "M";
  const birthDate = vo2MeasuredLatest?.birth_date || "";

  const ranges = React.useMemo(() => {
    try {
      const age = birthDate ? Math.floor((Date.now() - +new Date(birthDate)) / 3.15e10) : 0;
      const g = (vo2Ref as Group[]).find(x => x.sex === sex && age >= x.age_min && age <= x.age_max);
      return g?.ranges ?? [];
    } catch { return []; }
  }, [birthDate, sex]);

  const pickLevel = (v?: number | null) => {
    if (v == null || !Number.isFinite(v)) return null;
    const hit = ranges.find(rr => (rr.min == null || v >= rr.min) && (rr.max == null || v <= rr.max));
    if (!hit) return null;

    const lvlKey = hit.label.trim().toLowerCase();
    const localizedLabel = (t as any)(`common.levels.${lvlKey}`);
    return {
      label: localizedLabel === `common.levels.${lvlKey}` ? hit.label.trim() : localizedLabel,
      color: levelColor(hit.label),
    };
  };

  const estVal = vo2EstimatedLatest?.value ?? null;
  const levelMeasured = pickLevel(mVO2);
  const levelEstimated = pickLevel(estVal);

  const accent = levelMeasured?.color ?? levelEstimated?.color ?? appColors.brandPrimary;

  return (
    <WidgetCard
      title={t("VO2Max.widget.title")}
      tooltip={t("VO2Max.widget.tooltip")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accent}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading && !vo2EstimatedLatest ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className={showAdvanced ? "grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-4 md:gap-6" : "block"}>
          
          {/* SEKCIA: Odhad (Vždy viditeľná) */}
          <div className="min-w-0">
            <div className={WIDGET_META_LABEL}>
              {t("VO2Max.chart.estimated")}: {fmtDate(vo2EstimatedLatest?.measured_at ?? null)}
            </div>
            <div className={`${WIDGET_VALUE_ROW} flex flex-wrap items-center gap-2`}>
              <div className={WIDGET_VALUE_MAIN}>{estVal != null ? estVal.toFixed(1) : "—"}</div>
              <span className={WIDGET_VALUE_UNIT}> {t("common.units.vo2max")}</span>
              <div className="shrink-0">
                {levelEstimated ? <Pill label={levelEstimated.label} color={levelEstimated.color} /> : <span className={WIDGET_PLACEHOLDER}>—</span>}
              </div>
            </div>
          </div>

          {/* SEKCIA: Meranie (Len v ADVANCED režime) */}
          {showAdvanced && (
            <>
              <div className="hidden md:block w-px" style={{ background: appColors.surfaceCardBorder, opacity: 0.6 }} />
              
              <div className="min-w-0 mt-4 md:mt-0 border-t md:border-t-0 pt-4 md:pt-0" style={{ borderColor: appColors.surfaceCardBorder }}>
                <div className={WIDGET_META_LABEL}>
                  {t("VO2Max.chart.measured")}: {fmtDate(measuredDate)}
                </div>
                <div className={`${WIDGET_VALUE_ROW} flex flex-wrap items-center gap-2`}>
                  <div className={WIDGET_VALUE_MAIN}>{mVO2 != null ? mVO2.toFixed(1) : "—"}</div>
                  <span className={WIDGET_VALUE_UNIT}> {t("common.units.vo2max")}</span>
                  <div className="shrink-0">
                    {levelMeasured ? <Pill label={levelMeasured.label} color={levelMeasured.color} /> : <span className={WIDGET_PLACEHOLDER}>—</span>}
                  </div>
                </div>
              </div>
            </>
          )}
          
        </div>
      )}
    </WidgetCard>
  );
}
