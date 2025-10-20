// src/features/widgets/MonoStrainWidget.tsx
"use client";

import { useMemo } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import ClickableCard from "@/shared/components/ClickableCard";

ensureChartJSRegistered();

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { weeks, loading } = useActivityData();

  const rows = useMemo(() => weeks.slice(-4), [weeks]);
  const labels = useMemo(() => rows.map(r => r.label || r.week), [rows]);

  const mono = useMemo<number[]>(
    () => rows.map(r => (r.monotony?.time != null ? +r.monotony.time : NaN)),
    [rows]
  );
  const strn = useMemo<number[]>(
    () => rows.map(r => (r.strain?.time != null ? +r.strain.time : NaN)),
    [rows]
  );

  const strainMax = useMemo(() => {
    const nums = strn.filter((v) => Number.isFinite(v)) as number[];
    return nums.length ? Math.ceil(Math.max(...nums) * 1.1) : 10;
  }, [strn]);

  const data: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      { type: "line", label: "Monotony", data: mono, yAxisID: "y1",
        borderColor: THEME.chart.monotony, backgroundColor: THEME.chart.monotony,
        tension: 0.3, spanGaps: true, pointRadius: 2, borderWidth: 2, order: 2 },
      { type: "line", label: "Strain", data: strn, yAxisID: "y2",
        borderColor: THEME.chart.strain, backgroundColor: THEME.chart.strain,
        tension: 0.3, spanGaps: true, borderDash: [4,4], pointRadius: 2, borderWidth: 2, order: 3 },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 2, hitRadius: 8 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
    },
    layout: { padding: { left: 8, right: 16 } },
    scales: {
      y1: { position: "left",  min: 0, max: 3, grid: { color: THEME.chart.grid }, title: { display: true, text: "Monotony" } },
      y2: { position: "right", min: 0, max: strainMax, grid: { drawOnChartArea: false }, title: { display: true, text: "Strain" } },
      x:  { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <ClickableCard title={title} accent="bg-amber-500" onOpenDetail={onOpenDetail}>
      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <div style={{ height: THEME.chart.weeklyHeightCompact }}>
          <MixedChart type="line" data={data} options={options} />
        </div>
      )}
    </ClickableCard>
  );
}