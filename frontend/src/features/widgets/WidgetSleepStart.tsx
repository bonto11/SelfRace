// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import { checkRecoveryFreshness, HHMMToMinutes, minutesToHHMM, compareTimeToBaselineMinutes } from "@/shared/utils/recovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataContext";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

export default function WidgetSleepStart({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows } = useRecoveryData();

  const values = useMemo<(number | null)[]>(
    () => rows.map(r => (r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time)! : null)),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const cmp = compareTimeToBaselineMinutes(latest, FIX_BASELINE_MIN, TOL_MIN);

  const freshness = checkRecoveryFreshness(rows, r => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA ? "—" : Number.isFinite(latest as number) ? minutesToHHMM(latest as number) : "—";
  const note     = showNA ? freshness.message : cmp.note;
  const accent   = showNA ? "bg-slate-700" : cmp.accent;

  return (
    <RecoveryStatCard
      title="Sleep start"
      value={valueText}
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
