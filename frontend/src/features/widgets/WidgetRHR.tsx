// src/features/widgets/WidgetRHR.tsx
"use client";

import { useMemo } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/icons/LoadingSpinner";

export default function WidgetRHR({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  // Provider nemusí mať loading – držíme to voliteľné
  const { rows, loading: loadingRaw } = useRecoveryData() as {
    rows: any[];
    loading?: boolean;
  };
  const loading = !!loadingRaw;

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
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
    "lower-better",
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

  // Pri loaded = false: používame cmp.accent; pri loading/NA sivé pozadie
  const accent = loading
    ? "bg-slate-700"
    : showNA
    ? "bg-slate-700"
    : cmp.accent;

  return (
    <OpenerWidget
      title="Resting HR"
      accent={accent}
      onOpenDetail={onOpenDetail}
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
            <span className="text-xl opacity-80">bpm</span>
          </div>
          {note && <p className="opacity-80">{note}</p>}
        </>
      )}
    </OpenerWidget>
  );
}
