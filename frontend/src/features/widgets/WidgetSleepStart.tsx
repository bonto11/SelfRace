// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useMemo } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import {
  checkRecoveryFreshness,
  HHMMToMinutes,
  minutesToHHMM,
  compareTimeToBaselineMinutes,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataProvider";

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

export default function WidgetSleepStart({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows } = useRecoveryData();

  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) =>
        r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time)! : null
      ),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const cmp = compareTimeToBaselineMinutes(latest, FIX_BASELINE_MIN, TOL_MIN);
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
      title="Sleep start"
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
