// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import { checkRecoveryFreshness, minutesToHHMM, makeBaselinePoint, compareLatestToBaseline } from "@/shared/utils/recovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataContext";

export default function WidgetSleepDuration({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows } = useRecoveryData();

  const values = useMemo<(number | null)[]>(
    () => rows.map(r => (typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : null)),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo(() => makeBaselinePoint(values, 14, true), [values]);
  const cmp = compareLatestToBaseline(latest, baselinePoint, "higher-better", 0.05);

  const freshness = checkRecoveryFreshness(rows, r => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA ? "—" : Number.isFinite(latest as number) ? minutesToHHMM(latest as number) : "—";
  const note     = showNA ? freshness.message : cmp.note;
  const accent   = showNA ? "bg-slate-700" : cmp.accent;

  return (
    <RecoveryStatCard
      title="Sleep duration"
      value={valueText}
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
