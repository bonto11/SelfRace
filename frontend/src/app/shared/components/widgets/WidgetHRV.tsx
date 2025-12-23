// src/features/widgets/WidgetHRV.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";

export default function WidgetHRV({
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
      rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)),
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

  const accent = loading || showNA ? "bg-slate-700" : cmp.accent;

  return (
    <WidgetCard
      title="HRV (RMSSD)"
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
            <span className="text-xl opacity-80">ms</span>
          </div>
          {note && <p className="opacity-80">{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
