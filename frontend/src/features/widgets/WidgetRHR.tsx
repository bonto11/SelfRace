// src/features/widgets/WidgetRHR.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import {
  isoDate,
  makeBaselinePoint,
  compareLatestToBaseline,
  checkRecoveryFreshness,
} from "@/shared/utils/recovery";

type Row = { date: string; RHR_bpm: number | null };

export default function WidgetRHR({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=35`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json.data)) {
        const norm: Row[] = json.data
          .map((r: any) => ({ date: isoDate(r.date), RHR_bpm: r?.RHR_bpm ?? null }))
          .sort((a: {date: string}, b: {date: string}) => a.date.localeCompare(b.date));
        setRows(norm);
      }
    })();
  }, [userId]);

  const values = useMemo<(number | null)[]>(
    () => rows.map(r => (r?.RHR_bpm ?? null)),
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

  // RHR: lower-better
  const cmp = compareLatestToBaseline(latest, baselinePoint, "lower-better", 0.05);

  const freshness = checkRecoveryFreshness(rows, r => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA ? "—" : Number.isFinite(latest as number) ? String(Math.round(latest as number)) : "—";
  const note  = showNA ? freshness.message : cmp.note;
  const accent = showNA ? "bg-slate-700" : cmp.accent;

  return (
    <RecoveryStatCard
      title="Resting HR"
      value={valueText}
      unit="bpm"
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
