// src/features/widgets/MonoStrainWidget.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";

ensureChartJSRegistered();

type Row = {
  label: string;
  mono: number | null;
  strain: number | null;
};

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        // widget: stačia posledné 4 týždne
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=4`);
        const json = await res.json().catch(() => ({}));
        const src: any[] = Array.isArray(json?.weeks)
          ? json.weeks
          : Array.isArray(json?.data)
          ? json.data
          : [];

        const norm: Row[] = src.map((w) => ({
          label: w.label ?? w.week ?? w.iso_week ?? "",
          mono:
            w?.monotony?.time != null && Number.isFinite(+w.monotony.time)
              ? +w.monotony.time
              : null,
          strain:
            w?.strain?.time != null && Number.isFinite(+w.strain.time)
              ? +w.strain.time
              : null,
        }));
        setRows(norm);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  // Použi null namiesto NaN — Chart.js to korektne “vynechá”
  const monoSeries = useMemo<(number | null)[]>(
    () => rows.map((r) => (r.mono == null ? null : r.mono)),
    [rows]
  );
  const strainSeries = useMemo<(number | null)[]>(
    () => rows.map((r) => (r.strain == null ? null : r.strain)),
    [rows]
  );

  const strainMax = useMemo(() => {
    const nums = strainSeries.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    );
    return nums.length ? Math.ceil(Math.max(...nums) * 1.1) : 10;
  }, [strainSeries]);

  // DÔLEŽITÉ: povoľ (number | null)[] v ChartData
  const data: ChartData<"line", (number | null)[], string> = {
    labels,
    datasets: [
      {
        type: "line",
        label: "Monotony",
        data: monoSeries,
        yAxisID: "y1",
        borderColor: THEME.chart.monotony,
        backgroundColor: THEME.chart.monotony,
        tension: 0.3,
        spanGaps: true,
        pointRadius: 2,
        borderWidth: 2,
        order: 2,
      },
      {
        type: "line",
        label: "Strain",
        data: strainSeries,
        yAxisID: "y2",
        borderColor: THEME.chart.strain,
        backgroundColor: THEME.chart.strain,
        tension: 0.3,
        spanGaps: true,
        borderDash: [4, 4],
        pointRadius: 2,
        borderWidth: 2,
        order: 3,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false, // nech sa riadi výškou parenta
    animation: false,
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 2, hitRadius: 8 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = ctx.parsed.y as number;
            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v.toFixed(2)}`;
            if (ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;
            return `${label}: ${v}`;
          },
        },
      },
    },
    layout: { padding: { left: 8, right: 16 } },
    scales: {
      y1: {
        position: "left",
        min: 0,
        max: 3,
        grid: { color: THEME.chart.grid },
        title: { display: true, text: "Monotony" },
      },
      y2: {
        position: "right",
        min: 0,
        max: strainMax,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain" },
      },
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

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        // presne rovnaký pattern ako WeeklyLoadMini – fixná výška inline
        <div style={{ height: THEME.chart.weeklyHeightCompact }}>
          <MixedChart type="line" data={data} options={options} />
        </div>
      )}
    </div>
  );
}
