"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";

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

  const vals = useMemo(() => rows.map(r => r.RHR_bpm ?? NaN), [rows]);
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
    // pri RHR je nižšie lepšie
    if (diff <= -0.05) { note = "Včerajší RHR bol LEPŠÍ než priemer (↓)"; accent="bg-emerald-600"; }
    else if (diff >= 0.05) { note = "Včerajší RHR bol HORŠÍ než priemer (↑)"; accent="bg-amber-600"; }
    else { note = "Včerajší RHR bol V PRIEMERE"; accent="bg-sky-600"; }
  }

  return (
    <RecoveryStatCard
      title="Resting HR"
      value={Number.isFinite(yesterday) ? String(Math.round(yesterday as number)) : "—"}
      unit="bpm"
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
