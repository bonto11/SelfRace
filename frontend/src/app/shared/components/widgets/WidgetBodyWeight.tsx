// src/shared/components/widgets/WidgetBodyWeight.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Pill from "@/app/shared/ui/components/Pill";
import { fmtDate } from "@/app/shared/utils/time";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";

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
import { useT } from "@/app/shared/i18n/useT";

type Props = { 
  onOpen?: () => void; 
  onOpenDetail?: () => void;
  showAdvanced?: boolean;
};

export default function WidgetBodyWeight({ onOpen, onOpenDetail, showAdvanced = false }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { isChecking } = useUserId();
  
  const { data, loading } = usePerformanceData();
  const { weightLatest, profileStatic } = data; 

  const weight = weightLatest?.value ?? null;
  const updatedAt = weightLatest?.measured_at ?? null;
  const height = profileStatic?.height ?? null; // Výška v cm

  // Výpočet BMI a kategórie
  const bmi = React.useMemo(() => {
    if (!weight || !height) return null;
    const heightM = height / 100;
    return weight / (heightM * heightM);
  }, [weight, height]);

  const bmiLevel = React.useMemo(() => {
    if (bmi == null) return null;
    if (bmi < 18.5) return { label: t("common.levels.underweight" as any), color: appColors.stateEssential };
    if (bmi < 25) return { label: t("common.levels.normal" as any), color: appColors.statusSuccess };
    if (bmi < 30) return { label: t("common.levels.overweight" as any), color: appColors.stateAverage };
    return { label: t("common.levels.obese" as any), color: appColors.stateObese };
  }, [bmi, t]);

  return (
    <WidgetCard
      title={t("performance.metrics.weightLabel")}
      tooltip={t("volumeSection.widget.tooltip" as any)} // Alebo iný vhodný tooltip key
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={bmiLevel?.color ?? appColors.brandPrimary}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {isChecking || (loading && !weightLatest) ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className={showAdvanced ? "grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-4 md:gap-6" : "block"}>
          
          {/* SEKCIA: Váha (Vždy viditeľná) */}
          <div className="min-w-0">
            <div className={WIDGET_META_LABEL}>
              {t("performance.metrics.measuredPlaceholder")} {fmtDate(updatedAt)}
            </div>
            <div className={WIDGET_VALUE_ROW}>
              <div className={WIDGET_VALUE_MAIN}>
                {weight != null ? weight.toFixed(1) : "—"}
                <span className={WIDGET_VALUE_UNIT}> {t("common.units.kg")}</span>
              </div>
            </div>
          </div>

          {/* SEKCIA: BMI (Len v ADVANCED režime) */}
          {showAdvanced && (
            <>
              <div className="hidden md:block w-px" style={{ background: appColors.surfaceCardBorder, opacity: 0.6 }} />
              
              <div className="min-w-0 mt-4 md:mt-0 border-t md:border-t-0 pt-4 md:pt-0" style={{ borderColor: appColors.surfaceCardBorder }}>
                <div className={WIDGET_META_LABEL}>
                  {t("performance.metrics.bmiLabel")}
                </div>
                <div className={`${WIDGET_VALUE_ROW} flex flex-wrap items-center gap-2`}>
                  <div className={WIDGET_VALUE_MAIN}>{bmi != null ? bmi.toFixed(1) : "—"}</div>
                  <div className="shrink-0 ml-auto">
                    {bmiLevel ? <Pill label={bmiLevel.label} color={bmiLevel.color} /> : <span className={WIDGET_PLACEHOLDER}>—</span>}
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
