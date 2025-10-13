"use client";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

export default function WeeklyLoadMini({
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
