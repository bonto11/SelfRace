"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import RecoveryStatCard from "./RecoveryStatCard";

type Row = { date: string; sleep_start_time: string | null };

function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h * 60 + min;
}
function minutesToHHMM(total: number): string {
  const t = Math.max(0, Math.min(1439, Math.round(total)));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function WidgetSleepStart({ onOpenDetail }: { onOpenDetail?: () => void }) {
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

  const vals = useMemo(
    () =>
      rows.map(r => (r.sleep_start_time ? hhmmToMinutes(r.sleep_start_time)! : NaN)),
    [rows]
  );
  const yesterday = useMemo(() => vals.at(-1), [vals]);
  const baseline = useMemo(() => {
    const src = vals.slice(0, -1).slice(-28);
    const a = (src.length ? src : vals.slice(0, -1)).filter(Number.isFinite) as number[];
    return a.length ? Math.round(a.reduce((s,v)=>s+v,0)/a.length) : NaN;
  }, [vals]);

  let note = "Bez dát.";
  let accent = "bg-slate-700";
  if (Number.isFinite(yesterday) && Number.isFinite(baseline)) {
    const diffMin = (yesterday as number) - (baseline as number);
    const abs = Math.abs(diffMin);
    if (abs <= 30) { note = "Čas zaspania bol V PRIEMERE (±30 min)"; accent="bg-sky-600"; }
    else if (diffMin < 0) { note = "Zaspal si SKÔR než obvykle"; accent="bg-emerald-600"; }
    else { note = "Zaspal si NESKÔR než obvykle"; accent="bg-amber-600"; }
  }

  return (
    <RecoveryStatCard
      title="Sleep start"
      value={Number.isFinite(yesterday) ? minutesToHHMM(yesterday as number) : "—"}
      note={note}
      accent={accent}
      onOpenDetail={onOpenDetail}
    />
  );
}
