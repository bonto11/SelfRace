// src/features/widgets/WeeklyLoadMini.tsx
"use client";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

export default function WeeklyLoadMini({
  data,
  options,
}: {
  data: ChartData<"bar" | "line", number[], string>;
  options: ChartOptions<"bar" | "line">;
}) {
  return (
    <div style={{ height: THEME.chart.weeklyHeightCompact }}>
      <MixedChart type="bar" data={data} options={options} />
      <div className="mt-2 text-xs opacity-70">
        {THEME.copy.rotateHint}
      </div>
    </div>
  );
}
