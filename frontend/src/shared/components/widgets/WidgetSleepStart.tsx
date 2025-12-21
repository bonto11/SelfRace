// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import {
  checkRecoveryFreshness,
  compareTimeToBaselineMinutes,
} from "@/shared/utils/recovery";
import {
  HHMMToMinutes,minutesToHHMM,
} from "@/shared/utils/time";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

// hranica, od ktorej berieme spánok ako "večer predtým"
// všetko pred 18:00 berieme na porovnanie ako +24h (čiže po polnoci)
const EVENING_START_MIN = 18 * 60; // 18:00

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

  // úprava: časy po polnoci (napr. 00:30 = 30 min) berieme na porovnanie ako 24:30 (= 1470)
  const latestForCompare = useMemo<number | null>(() => {
    if (latest == null) return null;
    if (latest < EVENING_START_MIN) {
      // spánok po polnoci - posuň o 24h, aby to bolo "neskôr než 22:30"
      return latest + 24 * 60;
    }
    // normálny večer (18:00–24:00) – nechávame tak
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
  const accent = loading || showNA ? "bg-slate-700" : cmp.accent;

  return (
    <WidgetCard
      title="Sleep start"
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
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