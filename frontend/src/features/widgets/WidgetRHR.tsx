"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";
import { compareLatestToBaseline, rollingMean } from "@/shared/utils/recovery";

type Row = { date: string; RHR_bpm: number | null };

export default function WidgetRHR({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=35`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setRows(json.data);
    })();
  }, [userId]);

  const vals = useMemo(() => rows.map(r => r.RHR_bpm ?? null), [rows]);
  const yesterday = useMemo(() => {
    const v = vals.at(-1);
    return typeof v === "number" ? v : null;
  }, [vals]);

  // baseline = rollingMean(14d) pre každý deň; pre widget berieme „včerajší baseline“
  const baselines = useMemo(() => rollingMean(vals, 14), [vals]);
  const baselineYesterday = useMemo(() => baselines.at(-1) ?? null, [baselines]);

  const { note, accent } = compareLatestToBaseline(yesterday, baselineYesterday, "lower-better", 0.05);

  return (
    <RecoveryStatCard
      title="Resting HR"
      value={yesterday != null ? String(Math.round(yesterday)) : "—"}
      unit="bpm"
      note={note}
      accent={accent}
      buttonText="Detail"
      onOpenDetail={onOpenDetail}
    />
  );
}
