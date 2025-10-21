"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

ensureChartJSRegistered();

type Row = { label: string; easy_pct: number; hard_pct: number; easy_min: number; hard_min: number };

export default function TrendPareto8020() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<number>(8);       // 2 / 4 / 8 / 12
  const [sport, setSport] = useState<string>("all");    // voliteľný filter
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/pareto8020/${userId}?weeks=${weeks}&sport=${sport}`, { cache: "no-store" });
        const json = await res.json();
        const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
        setRows(arr);
      } catch (e) {
        setRows([]);
      }
    })();
  }, [userId, weeks, sport]);

  const labels = useMemo(() => rows.map(r => r.label), [rows]);
  const data: ChartData<"line", number[], string> = useMemo(() => ({
    labels,
    datasets: [
      {
        type: "line",
        label: "Easy %",
        data: rows.map(r => r.easy_pct ?? 0),
        borderColor: THEME.chart.mixed,       // zelenkavá, už v theme
        backgroundColor: THEME.chart.mixed,
        tension: 0.25,
        pointRadius: 2,
      },
      {
        type: "line",
        label: "Hard %",
        data: rows.map(r => r.hard_pct ?? 0),
        borderColor: THEME.chart.strength,    // oranžová zo theme
        backgroundColor: THEME.chart.strength,
        tension: 0.25,
        pointRadius: 2,
        borderDash: [4,4],
      },
    ],
  }), [rows, labels]);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", padding: 8, boxWidth: 6, boxHeight: 6 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y ?? 0;
            return `${ctx.dataset.label}: ${v.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: "%" }, grid: { color: THEME.chart.grid }},
      x: { ticks: { maxRotation: 0 }, grid: { color: THEME.chart.gridSoft } },
    }
  };

  const minWidth = Math.max(360, Math.round(labels.length * THEME.chart.pxPerLabel));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-2 text-xs">
          <select className="px-2 py-1 rounded bg-gray-700 text-white" value={weeks} onChange={e => setWeeks(Number(e.target.value))}>
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
          <select className="px-2 py-1 rounded bg-gray-700 text-white" value={sport} onChange={e => setSport(e.target.value)}>
            <option value="all">Všetko</option>
            <option value="run">Run</option>
            <option value="bike">Bike</option>
            <option value="strength">Strength</option>
            <option value="mixed">Mixed</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: 220 }}>
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <LineChart type="line" data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}