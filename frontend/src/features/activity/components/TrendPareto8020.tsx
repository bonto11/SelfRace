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
  label: string;          // napr. "2025-W41" alebo "2025-10-13…19"
  easy_pct?: number;      // 0..100 (môže chýbať)
  hard_pct?: number;      // 0..100 (môže chýbať)
  easy_min?: number;      // voliteľne minúty
  hard_min?: number;      // voliteľne minúty
};

const EASY_COLOR = "#00E676"; // zelená
const HARD_COLOR = "#FF5252"; // červená

const toNum = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export default function TrendPareto8020() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<2 | 4 | 8 | 12>(8);
  const [sport, setSport] = useState<string>("all"); // ⬅ default “all”
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    const url = `${API_URL}/analytics/pareto8020/${userId}?weeks=${weeks}&sport=${sport}`;
    fetch(url, { cache: "no-store" })
      .then(r => r.json())
      .then(j => setRows(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setRows([]));
  }, [userId, weeks, sport]);

  // robustné vypočítanie % aj keď API vráti len minúty
  const normalized = useMemo<Row[]>(() => {
    return (rows || []).map(r => {
      const em = toNum(r.easy_min, 0);
      const hm = toNum(r.hard_min, 0);
      const total = em + hm;
      const easyPct = r.easy_pct ?? (total > 0 ? (em / total) * 100 : 0);
      const hardPct = r.hard_pct ?? Math.max(0, 100 - easyPct);
      return { ...r, easy_pct: Math.round(easyPct * 10) / 10, hard_pct: Math.round(hardPct * 10) / 10 };
    });
  }, [rows]);

  const labels = useMemo(() => normalized.map(r => r.label), [normalized]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Easy %",
          data: normalized.map(r => toNum(r.easy_pct, 0)),
          borderColor: EASY_COLOR,
          backgroundColor: EASY_COLOR,
          tension: 0.25,
          pointRadius: 2,
        },
        {
          label: "Hard %",
          data: normalized.map(r => toNum(r.hard_pct, 0)),
          borderColor: HARD_COLOR,
          backgroundColor: HARD_COLOR,
          tension: 0.25,
          pointRadius: 2,
          borderDash: [4, 4],
        },
      ],
    }),
    [normalized, labels]
  );

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false }, // vlastná legenda nižšie (bodky)
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
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-3 text-xs">
          {/* vlastná legenda – farebné bodky vždy správnej farby */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <i style={{ width: 10, height: 10, borderRadius: "50%", background: EASY_COLOR, display: "inline-block" }} />
              Easy %
            </span>
            <span className="flex items-center gap-1">
              <i style={{ width: 10, height: 10, borderRadius: "50%", background: HARD_COLOR, display: "inline-block" }} />
              Hard %
            </span>
          </div>

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
          <div
            style={{
              minWidth,
              height: "100%",
              maxWidth: "none",
              // istota proti zafarbeniu canvasu
              filter: "none",
              mixBlendMode: "normal",
              isolation: "isolate",
            }}
          >
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}