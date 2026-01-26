// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  checkRecoveryFreshness,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/app/shared/utils/recovery";
import { minutesToHHMM } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

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

  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) =>
        typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : null
      ),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo(
    () => makeBaselinePoint(values, 14, true),
    [values]
  );

  const cmp = compareLatestToBaseline(
    latest,
    baselinePoint,
    "higher-better",
    0.05
  );
  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest)
      ? minutesToHHMM(latest as number)
      : "—";

  const note = showNA ? freshness.message : cmp.note;

  const CH = (THEME as any)?.chart ?? {};
  const accent = (() => {
    if (loading || showNA)
      return (
        CH.neutral ?? (THEME as any)?.accent?.neutral ?? appColors.textMuted
      );

    const a = String((cmp as any)?.accent ?? "").toLowerCase();

    if (a.includes("red"))
      return CH.danger ?? CH.obese ?? appColors.statusError;
    if (a.includes("amber") || a.includes("yellow"))
      return CH.warning ?? CH.average ?? appColors.statusWarning;
    if (a.includes("emerald") || a.includes("green"))
      return CH.positive ?? CH.fitness ?? appColors.brandPrimary;

    return (
      CH.neutral ?? (THEME as any)?.accent?.primary ?? appColors.textSecondary
    );
  })();

  return (
    <WidgetCard
      title="Sleep duration"
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
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
