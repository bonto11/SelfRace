"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
ensureChartJSRegistered();

type Row = { label: string; mono?: number | null; strain?: number | null };

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // endpoint na posledné 4 týždne (ľubovoľne uprav)
        const res = await fetch(`${API_URL}/analytics/mono-strain?weeks=4`);
        const json = await res.json().catch(() => ({}));
        const data: any[] = Array.isArray(json?.data) ? json.data : [];
        const num = (v: any) => (Number.isFinite(+v) ? +v : null);
        setRows(
          data.map((r) => ({
            label: r.label ?? r.week ?? "",
            mono: num(r.monotony),
            strain: num(r.strain),
          }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  const datasets = useMemo(
    () => [
      {
        type: "line" as const,
        label: "Monotony",
        data: rows.map((r) => (r.mono ?? NaN) as number | null),
        yAxisID: "y1",
        borderColor: THEME.chart.monotony,
        backgroundColor: THEME.chart.monotony,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        spanGaps: true,
      },
      {
        type: "line" as const,
        label: "Strain",
        data: rows.map((r) => (r.strain ?? NaN) as number | null),
        yAxisID: "y2",
        borderColor: THEME.chart.strain,
        backgroundColor: THEME.chart.strain,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        borderDash: [4, 4],
        spanGaps: true,
      },
    ],
    [rows]
  );

  const data: ChartData<"bar" | "line", (number | null)[], string> = { labels, datasets };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    elements: { point: { radius: 2, hitRadius: 8 } },
    plugins: {
      legend: {
        position: "top",
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            return `${label}: ${ctx.dataset.yAxisID === "y1" ? v.toFixed(2) : Math.round(v)}`;
          },
        },
      },
    },
    scales: {
      y1: { min: 0, max: 3, title: { display: true, text: "Monotony" }, grid: { color: THEME.chart.grid } },
      y2: { min: 0, max: 200, title: { display: true, text: "Strain" }, grid: { drawOnChartArea: false } },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <button onClick={onOpenDetail} className="text-xs px-2 py-1 rounded bg-gray-700">
          Detail
        </button>
      </div>
      {loading ? <div className="opacity-70 text-sm">Načítavam…</div> : <MixedChart type="line" data={data} options={options} />}
    </div>
  );
}
