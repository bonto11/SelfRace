// src/features/widgets/WidgetHRV.tsx
"use client";

import { useMemo } from "react";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataProvider";

export default function WidgetHRV({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows } = useRecoveryData();

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => r?.HRV_avg_ms ?? null),
    [rows]
  );

  const yesterday = useMemo<number | null>(() => {
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

  const cmp = compareLatestToBaseline(
    yesterday,
    baselinePoint,
    "higher-better",
    0.05
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(yesterday)
    ? String(Math.round(yesterday as number))
    : "—";
  const note = showNA ? freshness.message : cmp.note;
  const accent = showNA ? "bg-slate-700" : cmp.accent;

  return (
    <RecoveryStatCard
      title="HRV (RMSSD)"
      value={valueText}
      unit="ms"
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
