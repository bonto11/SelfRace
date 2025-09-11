"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";
import TrendWithBands, { Band, Point } from "@/components/Common/Charts/TrendWithBands";

type RecoveryRow = {
  date: string;
  HRV_avg_ms: number | null;
};

function median(xs: number[]) {
  if (!xs.length) return NaN;
  const a = [...xs].sort((a,b)=>a-b);
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
}

export default function TrendHRV() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<RecoveryRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const res = await fetch(`${API_URL}/recovery/${userId}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    }
    load();
  }, [userId]);

  const points: Point[] = useMemo(
    () => rows.map((r) => ({ date: r.date, value: r.HRV_avg_ms })),
    [rows]
  );

  // baseline z posledných 28 dní (alebo všetkých, ak máš menej)
  const baseline = useMemo(() => {
    const vals = points.map((p) => p.value).filter((v): v is number => v != null);
    const last = vals.slice(-28);
    return median(last.length ? last : vals);
  }, [points]);

  // vytvor pásma v „ms“ podľa % odchýlky od baseline
  const bands: Band[] = useMemo(() => {
    if (!isFinite(baseline) || baseline <= 0) return [];
    const hiMin = baseline * 1.03;
    const normMin = baseline * 0.97;
    const slLowMin = baseline * 0.93;
    const lowMin = baseline * 0.88;

    return [
      { label: "High",       min: hiMin,   max: null,   color: "#16a34a" },  // > +3%
      { label: "Normal",     min: normMin, max: hiMin,  color: "#22c55e" },  // ±3%
      { label: "Slightly low", min: slLowMin, max: normMin, color: "#eab308" }, // −3 až −7 %
      { label: "Low",        min: lowMin,  max: slLowMin, color: "#f97316" }, // −7 až −12 %
      { label: "Very low",   min: null,    max: lowMin,  color: "#dc2626" }, // < −12 %
    ];
  }, [baseline]);

  if (!points.length) return <div>Načítavam HRV…</div>;

  // navrh škály okolo baseline
  const yMax = Math.ceil((baseline || 60) * 1.3);
  const yMin = Math.floor((baseline || 60) * 0.6);

  return (
    <TrendWithBands
      title="Trend HRV (RMSSD)"
      points={points}
      bands={bands}
      unit="ms"
      lineColor="deepskyblue"
      ySuggestedMin={yMin}
      ySuggestedMax={yMax}
    />
  );
}