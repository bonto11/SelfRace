// src/components/Recovery/TrendSleepStart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";
import TrendWithBands from "@/components/Common/Charts/TrendWithBands";

type Row = {
  date: string;               // ISO (YYYY-MM-DD)
  sleep_start_time: string | null; // "HH:MM" alebo null
};

function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (isNaN(h) || isNaN(min)) return null;
  return h * 60 + min;
}

function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(1439, Math.round(total)));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

export default function TrendSleepStart() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        // načítaj posledných 90 dní, kľudne uprav
        const res = await fetch(`${API_URL}/recovery/${userId}?days=90`);
        const json = await res.json();
        if (json.success) {
          setRows(json.data);
        }
      } catch (e) { console.error("❌ [FE] SleepStart fetch err:", e); }
    })();
  }, [userId]);

  const points = useMemo(() => {
    return rows
      .filter(r => !!r.sleep_start_time)
      .map(r => ({
        date: r.date,
        value: hhmmToMinutes(r.sleep_start_time as string),
      }))
      .filter(p => p.value != null) as {date:string; value:number}[];
  }, [rows]);

  // voliteľné: odporúčaný interval zaspania (21:30–23:30)
  const bands = useMemo(() => ([
    { label: "Recommended", min: 21*60 + 30, max: 23*60 + 30, color: "#22C55E" },
  ]), []);

  return (
    <TrendWithBands
      title="Trend Sleep Start"
      points={points}
      bands={bands}
      lineColor="#06b6d4"
      ySuggestedMin={0}
      ySuggestedMax={1440}
      yTickFormatter={(v) => minutesToHHMM(v)}
    />
  );
}