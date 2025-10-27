// src/features/pareto/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS } from "@/shared/utils/format";

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
  onPickWeek?: (w: { start?: string; end?: string }) => void;
}) {
  const { getParetoTrend, weeks: providerWeeks } = useActivityData();
  const [lookback, setLookback] = useState<4 | 8 | 12>(4);
  const [sport, setSport] = useState<string>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  // fetch z PROVIDERA (žiadny priamy fetch na BE)
  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getParetoTrend(lookback, sport);
      if (!alive) return;
      setRows(Array.isArray(data) ? (data as Row[]) : []);
      setPickedIdx(null);
    })();
    return () => {
      alive = false;
    };
  }, [getParetoTrend, lookback, sport]);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  // mapovanie start/end ak by server neposlal (fallback z providerWeeks)
  const weekMap = useMemo(
    () => providerWeeks.slice(-lookback).map((w) => ({ start: w.start, end: w.end })),
    [providerWeeks, lookback]
  );

  // referenčné čiary 80/20
  const ref80 = useMemo(() => Array(labels.length).fill(80), [labels.length]);
  const ref20 = useMemo(() => Array(labels.length).fill(20), [labels.length]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: "line",
          label: "Easy %",
          data: rows.map((r) => (Number.isFinite(r.easy_pct) ? r.easy_pct : 0)),
          borderColor: THEME.chart.easy80,
          backgroundColor: THEME.chart.easy80,
          tension: 0.25,
          pointRadius: 2,
          order: 2,
        },
        {
          type: "line",
          label: "Hard %",
          data: rows.map((r) => (Number.isFinite(r.hard_pct) ? r.hard_pct : 0)),
          borderColor: THEME.chart.hard20,
          backgroundColor: THEME.chart.hard20,
          tension: 0.25,
          pointRadius: 2,
          borderDash: [4, 4],
          order: 2,
        },
        // referenčné čiary (bledšie, pod krivkami)
        {
          type: "line" as const,
          label: "80% ref",
          data: ref80,
          borderColor: THEME.chart?.ref80 ?? "rgba(74,222,128,0.35)",
          backgroundColor: THEME.chart?.ref80 ?? "rgba(74,222,128,0.35)",
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [6, 6],
          yAxisID: "y",
          order: 1,
        },
        {
          type: "line" as const,
          label: "20% ref",
          data: ref20,
          borderColor: THEME.chart?.ref20 ?? "rgba(248,113,113,0.35)",
          backgroundColor: THEME.chart?.ref20 ?? "rgba(248,113,113,0.35)",
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [6, 6],
          yAxisID: "y",
          order: 1,
        },
      ],
    }),
    [rows, labels, ref80, ref20]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: THEME.chart.legendPosition,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 8,
            boxWidth: 6,
            boxHeight: 6,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(1)}%`,
            footer: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              const r = rows[i];
              if (!r) return "";
              const easy = fmtSecondsHMS(r.easy_min || 0);
              const hard = fmtSecondsHMS(r.hard_min || 0);
              return `Easy ${easy} • Hard ${hard}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "%" },
          grid: { color: THEME.chart.grid },
        },
        x: {
          ticks: { maxRotation: 0 },
          grid: { color: THEME.chart.gridSoft },
        },
      },
      onClick: (_evt, elements) => {
        const idx = elements?.[0]?.index;
        if (idx == null) return;
        setPickedIdx(idx);
        const r = rows[idx];
        if (r?.start || r?.end) onPickWeek?.({ start: r.start, end: r.end });
        else {
          const m = weekMap[idx];
          if (m) onPickWeek?.(m);
        }
      },
    }),
    [rows, weekMap, onPickWeek]
  );

  const minWidth = Math.max(360, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));
  const picked = pickedIdx != null ? rows[pickedIdx] : null;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-2 text-xs">
          <select
            className="px-2 py-1 rounded bg-gray-700 text-white"
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value) as 4 | 8 | 12)}
          >
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

      {/* graf */}
      <div className="overflow-x-auto rounded-md" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: 240 }}>
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <LineChart type="line" data={data} options={options} />
          </div>
        </div>
      </div>

      {/* detail vybraného týždňa */}
      <div className="mt-2 text-xs opacity-80">
        {picked ? (
          <>
            <div className="font-semibold">{picked.label}</div>
            <div>
              Easy: {fmtSecondsHMS(picked.easy_min || 0)} ({Math.round(picked.easy_pct)}%)
              {" • "}
              Hard: {fmtSecondsHMS(picked.hard_min || 0)} ({Math.round(picked.hard_pct)}%)
            </div>
          </>
        ) : (
          <div>Klikni na bod v grafe pre zobrazenie detailu týždňa.</div>
        )}
      </div>
    </div>
  );
}