// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import {
  checkRecoveryFreshness,
  HHMMToMinutes,
  minutesToHHMM,
  compareTimeToBaselineMinutes,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

export default function WidgetSleepStart({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading: loadingRaw } = useRecoveryData() as { rows: any[]; loading?: boolean };
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

  const cmp = compareTimeToBaselineMinutes(latest, FIX_BASELINE_MIN, TOL_MIN);
  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText =
    showNA ? "—" : Number.isFinite(latest as number) ? minutesToHHMM(latest as number) : "—";
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
            <span className="text-5xl font-extrabold leading-none">{valueText}</span>
          </div>
          {note && <p className="opacity-80">{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}