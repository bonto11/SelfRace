// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  checkRecoveryFreshness,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/app/shared/utils/recovery";
import { minutesToHHMM_Time } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_NOTE,
  WIDGET_VALUE_UNIT
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function WidgetSleepDuration({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows, loading: loadingRaw } = useRecoveryData() as {
    rows: any[];
    loading?: boolean;
  };
  const loading = !!loadingRaw;
  const t = useT();
  
  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) =>
        typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : null,
      ),
    [rows],
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo(
    () => makeBaselinePoint(values, 14, true),
    [values],
  );

  const cmp = compareLatestToBaseline(
    latest,
    baselinePoint,
    "higher-better",
    0.05,
    t
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest)
      ? minutesToHHMM_Time(latest as number)
      : "—";

  // Lokalizovaná správa pre chýbajúce dáta alebo poznámka z porovnania
  const note = showNA ? t("sleepDuration.widget.noData") : cmp.note;

  const accent = (() => {
    if (loading || showNA) return appColors.stateNeutral;

    const a = String((cmp as any)?.accent ?? "").toLowerCase();

    if (a.includes("red")) return appColors.stateDanger;
    if (a.includes("amber") || a.includes("yellow"))
      return appColors.stateWarning;
    if (a.includes("emerald") || a.includes("green")) return "none";

    return "none";
  })();

  return (
    <WidgetCard
      title={t("sleepDuration.widget.title")}
      tooltip={t("sleepDuration.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.hour")}</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}