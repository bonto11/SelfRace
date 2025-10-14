"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";

type Row = { date: string; sleep_duration_min: number | null };

function minutesToHhMm(total: number): string {
  const t = Math.max(0, Math.round(total));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function WidgetSleepDuration({ onOpenDetail }: { onOpenDetail?: () => void }) {
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

  const vals = useMemo(() => rows.map(r => r.sleep_duration_min ?? NaN), [rows]);
  const yesterday = useMemo(() => vals.at(-1), [vals]);
  const baseline = useMemo(() => {
    const src = vals.slice(0, -1).slice(-28);
    const a = (src.length ? src : vals.slice(0, -1)).filter(Number.isFinite) as number[];
    return a.length ? a.reduce((s,v)=>s+v,0)/a.length : NaN;
  }, [vals]);

  let note = "Bez dát.";
  let accent = "bg-slate-700";
  if (Number.isFinite(yesterday) && Number.isFinite(baseline)) {
    const diff = (yesterday! - baseline!) / baseline!;
    if (diff >= 0.05) { note = "Spánok bol DLHŠÍ než priemer (↑)"; accent="bg-emerald-600"; }
    else if (diff <= -0.05) { note = "Spánok bol KRATŠÍ než priemer (↓)"; accent="bg-amber-600"; }
    else { note = "Spánok bol V PRIEMERE"; accent="bg-sky-600"; }
  }

  return (
    <RecoveryStatCard
      title="Sleep duration"
      value={Number.isFinite(yesterday) ? minutesToHhMm(yesterday as number) : "—"}
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
