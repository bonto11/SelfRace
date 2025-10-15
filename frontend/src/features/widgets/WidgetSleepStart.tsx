// src/features/widgets/WidgetSleepStart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "@/features/widgets/RecoveryStatCard";
import {
  checkRecoveryFreshness,
  HHMMToMinutes,
  minutesToHHMM,
  compareTimeToBaselineMinutes,
} from "@/shared/utils/recovery";

type Row = { date: string; sleep_start_time: string | null };

const FIX_BASELINE_MIN = 22 * 60 + 30; // 22:30
const TOL_MIN = 30;

export default function WidgetSleepStart({ onOpenDetail }: { onOpenDetail?: () => void }) {
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

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);

  const values = useMemo<(number | null)[]>(
    () => rows.map(r => (r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time)! : null)),
    [rows]
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // fixná baseline
  const cmp = compareTimeToBaselineMinutes(latest, FIX_BASELINE_MIN, TOL_MIN);
  const note = freshness.hasToday ? cmp.note : freshness.message;

  return (
    <RecoveryStatCard
      title="Sleep start"
      value={Number.isFinite(latest as number) ? minutesToHHMM(latest as number) : "—"}
      note={note}
      accent={cmp.accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
