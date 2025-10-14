"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklyLoadMini from "@/features/widgets/WeeklyLoadMini";

ensureChartJSRegistered();

export type WeekPick = { week: string; start: string; end: string };
type Metric = "time";

type WeekRow = {
  week: string; label: string; start: string; end: string;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
};

const C = {
  run: "#22D3EE", bike: "#A78BFA", strength: "#F59E0B", mixed: "#34D399", skate: "#60A5FA", other: "#9CA3AF",
};

function rangeLabel(start?: string, end?: string) {
  if (!start || !end) return "";
  const s = new Date(start), e = new Date(end);
  const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  return `${fmt(s)}–${fmt(e)}`;
}

export default function WeeklyLoadWidget({ title = "Týždenná záťaž (čas)" }: { title?: string }) {
  const { userId } = useUserId();
  const metric: Metric = "time";
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=2&metric=${metric}`);
        const json = await res.json().catch(() => ({}));
        const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
        setWeeks(raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: rangeLabel(w.start, w.end) || (w.label ?? w.week ?? ""),
          start: w.start ?? "", end: w.end ?? "",
          time_run_min: num(w.time_run_min ?? w.run_min),
          time_ride_min: num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_mixed_min: num(w.time_mixed_min),
          time_skate_min: num(w.time_skate_min),
          time_other_min: num(w.time_other_min ?? w.other_min),
        })));
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const labels = useMemo(() => weeks.map((w) => w.label), [weeks]);

  const datasets = useMemo(() => {
    const W = weeks;
    const ds: any[] = [];
    const push = (label: string, data: number[], color: string) =>
      ds.push({ type: "bar" as const, label, data, backgroundColor: color, borderColor: color, borderWidth: 1, yAxisID: "y" });

    push("Run", W.map((w) => w.time_run_min), C.run);
    if (W.some(w => w.time_ride_min > 0))      push("Bike",     W.map(w => w.time_ride_min),     C.bike);
    if (W.some(w => w.time_strength_min > 0))  push("Strength", W.map(w => w.time_strength_min), C.strength);
    if (W.some(w => w.time_mixed_min > 0))     push("Mixed",    W.map(w => w.time_mixed_min),    C.mixed);
    if (W.some(w => w.time_skate_min > 0))     push("Skate",    W.map(w => w.time_skate_min),    C.skate);
    if (W.some(w => w.time_other_min > 0))     push("Other",    W.map(w => w.time_other_min),    C.other);

    return ds;
  }, [weeks]);

  const data: ChartData<"bar" | "line", (number | null)[], string> = { labels, datasets };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    datasets: { bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 } },
    elements: { point: { radius: 2, hitRadius: 8 } },
    plugins: {
      legend: { position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label || ""}: ${Math.round((ctx.parsed.y ?? 0) as number)} min` } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "min" }, grid: { color: THEME.chart.grid } },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {loading ? <div className="opacity-70 text-sm">Načítavam…</div> : <WeeklyLoadMini data={data} options={options} />}
    </div>
  );
}
