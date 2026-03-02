// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  checkRecoveryFreshness,
  compareTimeToBaselineMinutes,
} from "@/app/shared/utils/recovery";
import { HHMMToMinutes, minutesToHHMM_Time } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

const EVENING_START_MIN = 18 * 60; // 18:00

function pickAccentFromCmp(
  cmpAccent: unknown,
  opts: { loading: boolean; showNA: boolean },
) {
  if (opts.loading || opts.showNA) {
    return appColors.stateNeutral;
  }

  const a = String(cmpAccent ?? "").toLowerCase();

  if (a.includes("red")) return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow"))
    return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return "none";

  return "none";
}

export default function WidgetSleepStart({
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
      rows.map((r) => {
        const m = r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time) : null;
        return typeof m === "number" ? m : null;
      }),
    [rows],
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const latestForCompare = useMemo<number | null>(() => {
    if (latest == null) return null;
    if (latest < EVENING_START_MIN) return latest + 24 * 60;
    return latest;
  }, [latest]);

  const cmp = compareTimeToBaselineMinutes(
    latestForCompare,
    FIX_BASELINE_MIN,
    TOL_MIN,
    t
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest)
      ? minutesToHHMM_Time(latest as number)
      : "—";

  const note = showNA ? t("sleepStart.widget.noData") : cmp.note;

  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });

  return (
    <WidgetCard
      title={t("sleepStart.widget.title")}
      tooltip={t("sleepStart.widget.tooltip")}
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