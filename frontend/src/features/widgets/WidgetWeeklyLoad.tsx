// src/features/widgets/WidgetWeeklyLoad.tsx
"use client";

import { useMemo } from "react";
import type { ChartData, ChartOptions } from "chart.js";
import { Chart as MixedChart } from "react-chartjs-2";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import ClickableCard from "@/shared/components/ClickableCard";

ensureChartJSRegistered();

const C = {
  run: "#22D3EE",
  bike: "#A78BFA",
  strength: "#F59E0B",
  mixed: "#34D399",
  skate: "#60A5FA",
  other: "#9CA3AF",
};

// --- lokálny mini-chart komponent (bol pôvodne v WeeklyLoadMini.tsx) ---
function MiniChart({
  data,
  options,
}: {
  data: ChartData<"bar" | "line", (number | null)[], string>;
  options?: ChartOptions<"bar" | "line">;
}) {
  const opts: ChartOptions<"bar" | "line"> = {
    ...options,
    maintainAspectRatio: false,
    datasets: { bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 } },
    elements: { point: { radius: 2, hitRadius: 8 } },
    layout: { padding: { left: 8, right: 8 } },
    scales: {
      ...(options?.scales || {}),
      x: { grid: { color: THEME.chart.gridSoft } },
      y: { grid: { color: THEME.chart.grid } },
    },
  };
  return (
    <div style={{ height: THEME.chart.weeklyHeightCompact }}>
      <MixedChart type="bar" data={data} options={opts} />
    </div>
  );
}

// --- widget ---
export default function WeeklyLoadWidget({
  title = "Týždenná záťaž (čas)",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { weeks, loading } = useActivityData();

  const last2 = useMemo(() => weeks.slice(-2), [weeks]);
  const labels = useMemo(() => last2.map(w => w.label || w.week), [last2]);

  const datasets = useMemo(() => {
    const W = last2;
    const ds: any[] = [];
    const push = (label: string, data: number[], color: string) =>
      ds.push({ type: "bar" as const, label, data, backgroundColor: color, borderColor: color, borderWidth: 1, yAxisID: "y" });

    const get = (f: (w: typeof W[number]) => number) => W.map(f);

    push("Run",      get(w => w.time_run_min),      C.run);
    if (W.some(w => w.time_ride_min     > 0)) push("Bike",     get(w => w.time_ride_min),     C.bike);
    if (W.some(w => w.time_strength_min > 0)) push("Strength", get(w => w.time_strength_min), C.strength);
    if (W.some(w => w.time_mixed_min    > 0)) push("Mixed",    get(w => w.time_mixed_min),    C.mixed);
    if (W.some(w => w.time_skate_min    > 0)) push("Skate",    get(w => w.time_skate_min),    C.skate);
    if (W.some(w => w.time_other_min    > 0)) push("Other",    get(w => w.time_other_min),    C.other);

    return ds;
  }, [last2]);

  const data: ChartData<"bar" | "line", (number | null)[], string> = { labels, datasets };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label || ""}: ${Math.round((ctx.parsed.y ?? 0) as number)} min`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "min" } },
    },
  };

  return (
    <ClickableCard title={title} accent="bg-blue-700" onOpenDetail={onOpenDetail}>
      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <MiniChart data={data} options={options} />
      )}
    </ClickableCard>
  );
}