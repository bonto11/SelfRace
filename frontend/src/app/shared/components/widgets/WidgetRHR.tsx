// src/features/widgets/WidgetRHR.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

export default function WidgetRHR({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading: loadingRaw } = useRecoveryData() as {
    rows: any[];
    loading?: boolean;
  };
  const loading = !!loadingRaw;

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  const cmp = compareLatestToBaseline(latest, baselinePoint, "lower-better", 0.05);
  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText =
    showNA ? "—" : Number.isFinite(latest) ? String(Math.round(latest as number)) : "—";

  const note = showNA ? freshness.message : cmp.note;

  const CH = (THEME as any)?.chart ?? {};
  const accent = (() => {
    if (loading || showNA) return CH.neutral ?? (THEME as any)?.accent?.neutral ?? appColors.textMuted;

    const a = String((cmp as any)?.accent ?? "").toLowerCase();

    if (a.includes("red")) return CH.danger ?? CH.obese ?? appColors.statusError;
    if (a.includes("amber") || a.includes("yellow")) return CH.warning ?? CH.average ?? appColors.statusWarning;
    if (a.includes("emerald") || a.includes("green")) return CH.positive ?? CH.fitness ?? appColors.brandPrimary;

    return CH.neutral ?? (THEME as any)?.accent?.primary ?? appColors.textSecondary;
  })();

  return (
    <WidgetCard
      title="Resting HR"
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
            <span className={WIDGET_VALUE_UNIT}>bpm</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}