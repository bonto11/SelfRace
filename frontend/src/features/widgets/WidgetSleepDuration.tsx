// src/features/widgets/WidgetSleepDuration.tsx
"use client";

import { useMemo } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import {
  checkRecoveryFreshness,
  minutesToHHMM,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataProvider";

export default function WidgetSleepDuration({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows } = useRecoveryData();

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
  const accent = showNA ? "bg-slate-700" : cmp.accent;

  return (
    <OpenerWidget
      title="Sleep duration"
      accent={accent}
      onOpenDetail={onOpenDetail}
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-5xl font-extrabold leading-none">
          {valueText}
        </span>
      </div>
      {note && <p className="opacity-80">{note}</p>}
    </OpenerWidget>
  );
}
