// src/features/pareto/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";

ensureChartJSRegistered();

type Row = {
  label: string;
  easy_min: number;
  hard_min: number;
  easy_pct: number;
  hard_pct: number;
  start?: string;
  end?: string;
};

export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: { start?: string; end?: string; week?: string }) => void;
}) {
  const { getParetoTrend } = useActivityData();
  const [weeks, setWeeks] = useState<2 | 4 | 8 | 12>(8);
  const [sport, setSport] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const data = await getParetoTrend(weeks, sport);
      setRows(Array.isArray(data) ? (data as Row[]) : []);
    })();
  }, [getParetoTrend, weeks, sport]);

  const labels = useMemo(() => rows.map(r => r.label), [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => ({
    labels,
    datasets: [
      {
        type: "line",
        label: "Easy %",
        data: rows.map(r => Number.isFinite(r.easy_pct) ? r.easy_pct : 0),
        borderColor: THEME.chart.easy80,
        backgroundColor: THEME.chart.easy80,
        tension: 0.25,
        pointRadius: 2,
      },
      {
        type: "line",
        label: "Hard %",
        data: rows.map(r => Number.isFinite(r.hard_pct) ? r.hard_pct : 0),
        borderColor: THEME.chart.hard20,
        backgroundColor: THEME.chart.hard20,
        tension: 0.25,
        pointRadius: 2,
        borderDash: [4,4],
      },
    ]
  }), [rows, labels]);

  const options: ChartOptions<"line"> = useMemo(() => ({
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
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(1)}%`,
          footer: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const r = rows[idx];
            if (!r) return "";
            return `Easy ${Math.round(r.easy_min)} min • Hard ${Math.round(r.hard_min)} min`;
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: "%" }, grid: { color: THEME.chart.grid }},
      x: { ticks: { maxRotation: 0 }, grid: { color: THEME.chart.gridSoft } },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index;
      if (idx == null) return;
      const r = rows[idx];
      onPickWeek?.({ start: r.start, end: r.end });
    }
  }), [rows, onPickWeek]);

  const minWidth = Math.max(360, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-2 text-xs">
          <select className="px-2 py-1 rounded bg-gray-700 text-white" value={weeks} onChange={e => setWeeks(Number(e.target.value) as 2|4|8|12)}>
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
        <div style={{ height: 240 }}>
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <LineChart type="line" data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}