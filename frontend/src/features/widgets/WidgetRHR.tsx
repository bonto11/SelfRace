// src/features/recovery/components/WidgetRHR.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";
import {
  makeRollingBaseline,
  compareLatestToBaseline,
} from "@/shared/utils/recovery";

type Row = { date: string; RHR_bpm: number | null; note?: string | null };

export default function WidgetRHR({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const router = useRouter();
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=60`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setRows(json.data);
      }
    })();
  }, [userId]);

  // séria RHR (denné body)
  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
    [rows]
  );

  // baseline (14d roll, bez aktuálneho dňa) – rovnaké ako v detaile
  const { baseline: bl } = useMemo(
    () => makeRollingBaseline(values, 14, 0.05),
    [values]
  );

  const yesterday = values.at(-1) ?? null;
  const baselineYesterday = bl.at(-1) ?? null;

  const { note, accent } = compareLatestToBaseline(
    yesterday,
    baselineYesterday,
    "lower-better",
    0.05
  );

  const openDetail = () => {
    if (onOpenDetail) onOpenDetail();
    else router.push("/recovery/rhr"); // route tvojho detailu
  };

  return (
    <RecoveryStatCard
      title="Resting HR"
      value={Number.isFinite(yesterday as number) ? String(Math.round(yesterday as number)) : "—"}
      unit="bpm"
      note={note}
      accent={accent}
      onOpenDetail={openDetail}
    />
  );
}
