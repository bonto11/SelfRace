// src/components/Recovery/TrendSleepDuration.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import TrendWithBands from "@/shared/components/TrendWithBands";

type Row = {
  date: string;
  sleep_duration_min: number | null;
};

function minutesToHhMm(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function TrendSleepDuration() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/recovery/${userId}?days=90`);
        const json = await res.json();
        if (json.success) {
          setRows(json.data);
        }
      } catch (e) {
        console.error("❌ [FE] SleepDuration fetch err:", e);
      }
    })();
  }, [userId]);

  const points = useMemo(() => {
    return rows
      .filter((r) => r.sleep_duration_min != null)
      .map((r) => ({
        date: r.date,
        value: r.sleep_duration_min as number,
      }));
  }, [rows]);

  // voliteľné: 7–9 hodín
  const bands = useMemo(
    () => [{ label: "7–9h recommended", min: 420, max: 540, color: "#22C55E" }],
    []
  );

  // nastav rozsah napr. 0–10h (600 min)
  return (
    <TrendWithBands
      title="Trend Sleep Duration"
      points={points}
      bands={bands}
      lineColor="#8b5cf6"
      ySuggestedMin={0}
      ySuggestedMax={600}
      yTickFormatter={(v) => minutesToHhMm(v)}
    />
  );
}
