// src/features/widgets/WidgetRHR.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
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
      if (json?.success && Array.isArray(json.data)) setRows(json.data);
    })();
  }, [userId]);

  const values = useMemo<(number | null)[]>(
    () => rows.map(r => (r?.RHR_bpm ?? null)),
    [rows]
  );

  // baseline len zo „včera späť“ (bez posledného dňa)
  const yesterday = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);            // bez včerajška
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return (typeof last === "number" ? last : null);
  }, [values]);

  const { note, accent } = compareLatestToBaseline(
    yesterday,
    baselinePoint,
    "lower-better",
    0.05
  );

  return (
    <RecoveryStatCard
      title="Resting HR"
      value={Number.isFinite(yesterday) ? String(Math.round(yesterday as number)) : "—"}
      unit="bpm"
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}   // celý panel je klikateľný
    />
  );
}
