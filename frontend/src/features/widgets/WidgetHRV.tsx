// src/features/widgets/WidgetHRV.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import {
  makeRollingBaseline,
  compareLatestToBaseline,
  checkRecoveryFreshness,
} from "@/shared/utils/recovery";

type Row = { date: string; HRV_avg_ms: number | null };

export default function WidgetHRV({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=35`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json.data)) setRows(json.data);
    })();
  }, [userId]);

  // hodnoty a "včerajšok"
  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (r?.HRV_avg_ms ?? null)),
    [rows]
  );

  const yesterday = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // baseline = klzavý priemer z *predchádzajúcich dní* (aktuálny deň vylúčený)
  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);           // bez včerajška
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  // pri HRV platí "higher-better"
  const cmp = compareLatestToBaseline(yesterday, baselinePoint, "higher-better", 0.05);

  // "čerstvosť" záznamu
  const freshness = checkRecoveryFreshness(rows, r => r.date);
  const showNA = !freshness.hasToday;

  // ak chýba dnešok, prepíš text na hlášku o chýbajúcich dátach
  const valueText = showNA
  ? "—" // alebo "N/A"
  : Number.isFinite(yesterday) ? String(Math.round(yesterday as number)) : "—";

  const note  = showNA ? freshness.message : cmp.note;
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
