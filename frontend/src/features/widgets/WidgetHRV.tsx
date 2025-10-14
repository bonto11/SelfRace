"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";

type Row = { date: string; HRV_avg_ms: number | null };

export default function WidgetHRV({ onOpenDetail }: { onOpenDetail?: () => void }) {
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

  const vals = useMemo(() => rows.map(r => r.HRV_avg_ms ?? NaN), [rows]);
  const yesterday = useMemo(() => vals.at(-1), [vals]);
  const baseline = useMemo(() => {
    const last28 = vals.slice(-29, -1); // 28 dní pred včerajškom
    const src = last28.length ? last28 : vals.slice(0, -1);
    const a = src.filter(Number.isFinite) as number[];
    return a.length ? a.reduce((s,v)=>s+v,0)/a.length : NaN;
  }, [vals]);

  let note = "Bez dát.";
  let accent = "bg-slate-700";
  if (Number.isFinite(yesterday) && Number.isFinite(baseline)) {
    const diff = (yesterday! - baseline!) / baseline!;
    if (diff >= 0.05) { note = "Včerajšie HRV bolo NAD priemerom (↑)"; accent="bg-emerald-600"; }
    else if (diff <= -0.05) { note = "Včerajšie HRV bolo POD priemerom (↓)"; accent="bg-amber-600"; }
    else { note = "Včerajšie HRV bolo V PRIEMERE"; accent="bg-sky-600"; }
  }

  return (
    <RecoveryStatCard
      title="HRV (RMSSD)"
      value={Number.isFinite(yesterday) ? String(Math.round(yesterday as number)) : "—"}
      unit="ms"
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
