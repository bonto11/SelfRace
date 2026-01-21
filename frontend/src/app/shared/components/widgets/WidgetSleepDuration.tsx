// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import {
  checkRecoveryFreshness,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/app/shared/utils/recovery";
import { minutesToHHMM } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/theme/app_colors";
import { WIDGET_LOADING_WRAP } from "@/app/shared/theme/uiTokens";

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
    : Number.isFinite(latest as number)
    ? minutesToHHMM(latest as number)
    : "—";

  const note = showNA ? freshness.message : cmp.note;

  // ❌ preč bg-* triedy / statické farby
  // cmp.accent je dnes zrejme "bg-..." → map na THEME/appColors
  const accent = (() => {
    if (loading || showNA) {
      return THEME?.chart?.neutral ?? (THEME as any)?.accent?.neutral ?? appColors.textMuted;
    }

    const a = String((cmp as any)?.accent ?? "").toLowerCase();
    if (a.includes("red")) return THEME?.chart?.bad ?? THEME?.chart?.danger ?? (THEME as any)?.chart?.obese;
    if (a.includes("amber") || a.includes("yellow")) return THEME?.chart?.fair ?? THEME?.chart?.average ?? THEME?.chart?.warning;
    if (a.includes("emerald") || a.includes("green")) return THEME?.chart?.good ?? THEME?.chart?.positive ?? THEME?.chart?.fitness;

    return THEME?.chart?.neutral ?? (THEME as any)?.accent?.primary ?? appColors.textSecondary;
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
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-extrabold leading-none">
              {valueText}
            </span>
          </div>
          {note && <p className="opacity-80">{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}