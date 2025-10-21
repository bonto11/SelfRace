// src/features/analytics/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend
);

type Row = {
  label: string;     // napr. "2025-W41"
  easy_pct: number;  // 0..100
  hard_pct: number;  // 0..100
  easy_min?: number;
  hard_min?: number;
};

const EASY_COLOR = "#00E676";
const HARD_COLOR = "#FF5252";

export default function TrendPareto8020() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<2 | 4 | 8 | 12>(8);
  const [sport, setSport] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    const url = `${API_URL}/analytics/pareto8020/${userId}?weeks=${weeks}&sport=${sport}`;
    fetch(url, { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        const arr: Row[] = Array.isArray(j?.data) ? j.data : [];
        setRows(arr);
      })
      .catch(() => setRows([]));
  }, [userId, weeks, sport]);

  const labels = useMemo(() => rows.map(r => r.label), [rows]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Easy %",
          data: rows.map(r => r.easy_pct ?? 0),
          borderColor: EASY_COLOR,
          backgroundColor: EASY_COLOR,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Hard %",
          data: rows.map(r => r.hard_pct ?? 0),
          borderColor: HARD_COLOR,
          backgroundColor: HARD_COLOR,
          tension: 0.25,
          pointRadius: 2,
          borderDash: [4, 4],
        },
      ],
    }),
    [rows, labels]
  );

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true, pointStyle: "circle", padding: 8, boxWidth: 6, boxHeight: 6 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y ?? 0;
            return `${ctx.dataset.label}: ${v.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: true, max: 100, title: { display: true, text: "%" } },
      x: { ticks: { maxRotation: 0 } },
    },
  };

  const minWidth = Math.max(360, Math.round(labels.length * 26));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-2 text-xs">
          <select
            className="px-2 py-1 rounded bg-gray-700 text-white"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) as 2 | 4 | 8 | 12)}
          >
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
          <select
            className="px-2 py-1 rounded bg-gray-700 text-white"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
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
          <div style={{ minWidth, height: "100%", maxWidth: "none", filter: "none", mixBlendMode: "normal", isolation: "isolate" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}