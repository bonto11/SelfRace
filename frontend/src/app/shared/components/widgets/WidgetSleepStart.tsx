// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import {
  checkRecoveryFreshness,
  compareTimeToBaselineMinutes,
} from "@/app/shared/utils/recovery";
import { HHMMToMinutes, minutesToHHMM } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { THEME } from "@/app/shared/theme/tokens";
import { appColors } from "@/app/shared/theme/app_colors";
import { WIDGET_LOADING_WRAP } from "@/app/shared/theme/uiTokens";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

// hranica, od ktorej berieme spánok ako "večer predtým"
// všetko pred 18:00 berieme na porovnanie ako +24h (čiže po polnoci)
const EVENING_START_MIN = 18 * 60; // 18:00

function pickAccentFromCmp(
  cmpAccent: unknown,
  opts: { loading: boolean; showNA: boolean }
) {
  if (opts.loading || opts.showNA) {
    return (
      THEME?.chart?.neutral ??
      (THEME as any)?.accent?.neutral ??
      appColors.textMuted
    );
  }

  // cmp.accent je dnes zrejme "bg-..." → map na THEME/appColors
  const a = String(cmpAccent ?? "").toLowerCase();
  if (a.includes("red"))
    return (
      THEME?.chart?.bad ??
      THEME?.chart?.danger ??
      (THEME as any)?.chart?.obese ??
      appColors.brandPrimary
    );
  if (a.includes("amber") || a.includes("yellow"))
    return (
      THEME?.chart?.fair ??
      THEME?.chart?.average ??
      THEME?.chart?.warning ??
      appColors.accentTeal
    );
  if (a.includes("emerald") || a.includes("green"))
    return (
      THEME?.chart?.good ??
      THEME?.chart?.positive ??
      THEME?.chart?.fitness ??
      appColors.accentTeal
    );

  return (
    THEME?.chart?.neutral ??
    (THEME as any)?.accent?.primary ??
    appColors.textSecondary
  );
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

  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) => {
        const m = r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time) : null;
        return typeof m === "number" ? m : null;
      }),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // časy po polnoci (napr. 00:30 = 30 min) porovnávame ako 24:30 (= 1470)
  const latestForCompare = useMemo<number | null>(() => {
    if (latest == null) return null;
    if (latest < EVENING_START_MIN) return latest + 24 * 60;
    return latest;
  }, [latest]);

  const cmp = compareTimeToBaselineMinutes(
    latestForCompare,
    FIX_BASELINE_MIN,
    TOL_MIN
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(latest as number)
    ? minutesToHHMM(latest as number)
    : "—";

  const note = showNA ? freshness.message : cmp.note;

  // ❌ preč "bg-*" / statické farby
  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });

  return (
    <WidgetCard
      title="Sleep start"
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