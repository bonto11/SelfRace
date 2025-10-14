"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import rhrRef from "@/data/RHR_Ref_VerywellFit.json";
import Link from "next/link";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, annotationPlugin);

type Row = { date: string; RHR_bpm: number | null };
type StaticProfile = { sex: "M" | "F"; birth_date: string };

function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

export default function DetailRHR() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [stat, setStat] = useState<StaticProfile | null>(null);
  const [weeks, setWeeks] = useState(8); // 2/4/8/12

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const rec = await fetch(`${API_URL}/recovery/${userId}?days=${days}`).then(r => r.json()).catch(() => ({}));
      if (rec?.success) setRows(rec.data);
      const st = await fetch(`${API_URL}/profile/static/${userId}`).then(r => r.json()).catch(() => ({}));
      if (st?.success) setStat(st.data);
    })();
  }, [userId, weeks]);

  const labels = useMemo(() => rows.map(r => fmtDay(r.date)), [rows]);
  const series = useMemo(() => rows.map(r => (r.RHR_bpm ?? null)), [rows]);

  // pásma podľa veku/pohlavia
  const annotations = useMemo(() => {
    if (!stat) return {};
    const age = Math.floor((Date.now() - new Date(stat.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000));
    const group = (rhrRef as any[]).find((g) => g.sex === stat.sex && age >= g.age_min && age <= g.age_max);
    const bands = (group?.ranges ?? []) as { label: string; min: number | null; max: number | null; color: string }[];
    const acc: any = {};
    bands.forEach((b, i) => {
      acc["band" + i] = {
        type: "box",
        yMin: b.min ?? -Infinity,
        yMax: b.max ?? Infinity,
        backgroundColor: (b.color || "#22c55e") + "33",
        borderWidth: 0,
      };
    });
    return acc;
  }, [stat]);

  const data = useMemo(() => ({
    labels,
    datasets: [{
      label: "Resting HR",
      data: series,
      borderColor: "#f59e0b",
      backgroundColor: "#f59e0b",
      tension: 0.25,
      pointRadius: 2,
    }],
  }), [labels, series]);

  // rovnaká šírka tickov / horizontálny scroll ako pri WeeklyLoad
  const PX_PER_TICK = (THEME as any)?.chart?.weeklyPxPerLabel ?? 48;
  const minWidth = Math.max(320, Math.round(labels.length * PX_PER_TICK));

  const options: any = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { bottom: 12 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed.y;
            return v == null ? "" : `RHR: ${Math.round(v)} bpm`;
          },
        },
      },
      annotation: { annotations },
    },
    scales: {
      y: { beginAtZero: false, min: 40, max: 100, grid: { color: THEME.chart.grid }, title: { display: true, text: "bpm" } },
      x: {
        grid: { color: THEME.chart.gridSoft },
        ticks: { autoSkip: true, minRotation: 55, maxRotation: 55, padding: 6, font: { size: 10 } },
      },
    },
  }), [annotations]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Detail – Resting HR</h2>
        <Link href="/recovery" className="px-3 py-1.5 rounded bg-gray-700 text-sm">Späť</Link>
      </div>

      <div className="mb-3 text-xs flex items-center gap-2">
        <span className="opacity-70">Rozsah:</span>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="px-2 py-1 rounded bg-gray-700">
          <option value={2}>2 týždne</option>
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      <div className="overflow-x-auto overflow-y-hidden rounded-md min-w-0" style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
        <div className="chart-fixed-h" style={{ height: THEME.chart.weeklyHeight }}>
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}
