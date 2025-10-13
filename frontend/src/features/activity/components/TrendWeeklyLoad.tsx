// src/features/activity/components/TrendWeeklyLoad.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import ChartScroller from "@/features/widgets/ChartScroller";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";

type WeekRow = {
  week: string; label: string; start: string; end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number;
  trimp_mixed: number; trimp_skate: number; trimp_other: number;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

const C = {
  run: THEME.chart.run, bike: THEME.chart.bike, strength: THEME.chart.strength,
  mixed: THEME.chart.mixed, skate: THEME.chart.skate, other: THEME.chart.other,
  monotony: THEME.chart.monotony, strain: THEME.chart.strain,
};

// (voliteľné) podpora THEME.chart.bar; fallback na defaulty
const BAR = {
  maxBarThickness: (THEME as any)?.chart?.bar?.maxBarThickness ?? 12,
  categoryPercentage: (THEME as any)?.chart?.bar?.categoryPercentage ?? 0.6,
  barPercentage: (THEME as any)?.chart?.bar?.barPercentage ?? 0.7,
};

// zistím orientáciu, aby sme dali nižší graf v landscape
function useIsPortrait() {
  const [portrait, setPortrait] = useState(
    typeof window === "undefined" ? true : window.innerHeight >= window.innerWidth
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setPortrait(window.innerHeight >= window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return portrait;
}

export type WeekPick = { week: string; start: string; end: string };

export default function TrendWeeklyLoad({
  onPickWeek,
}: { onPickWeek?: (w: WeekPick) => void }) {
  const { userId } = useUserId();
  const isPortrait = useIsPortrait();

  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(8);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [picked, setPicked] = useState<WeekPick | null>(null);

  // --- fetch -----------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=${lookback}`);
      const json = await res.json().catch(() => ({}));
      const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
      const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
      setWeeks(raw.map((w) => ({
        week: w.week ?? w.iso_week ?? w.label ?? "",
        label: w.label ?? w.week ?? w.iso_week ?? "",
        start: w.start ?? "", end: w.end ?? "",
        km_run: num(w.km_run ?? w.run_km),
        km_ride: num(w.km_ride ?? w.ride_km ?? w.km_bike),
        km_mixed: num(w.km_mixed), km_skate: num(w.km_skate),
        time_run_min: num(w.time_run_min ?? w.run_min),
        time_ride_min: num(w.time_ride_min ?? w.ride_min),
        time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
        time_mixed_min: num(w.time_mixed_min), time_skate_min: num(w.time_skate_min),
        time_other_min: num(w.time_other_min ?? w.other_min),
        trimp_run: num(w.trimp_run ?? w.run_trimp),
        trimp_ride: num(w.trimp_ride ?? w.bike_trimp),
        trimp_strength: num(w.trimp_strength ?? w.strength_trimp),
        trimp_mixed: num(w.trimp_mixed), trimp_skate: num(w.trimp_skate),
        trimp_other: num(w.trimp_other ?? w.other_trimp),
        monotony: w.monotony ?? {}, strain: w.strain ?? {},
      })));
    })();
  }, [userId, lookback]);

  // --- series ----------------------------------------------------------------
  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);

  const mono = useMemo<(number | null)[]>(
    () => weeks.map((w) => w.monotony?.[metric] ?? null),
    [weeks, metric]
  );
  const strn = useMemo<(number | null)[]>(
    () => weeks.map((w) => w.strain?.[metric] ?? null),
    [weeks, metric]
  );

  const datasets = useMemo(() => {
    const W = weeks;
    const ds: any[] = [];
    const add = (label: string, data: number[], color: string) =>
      ds.push({ type: "bar" as const, label, data, backgroundColor: color, borderColor: color, borderWidth: 1, yAxisID: "y" });

    if (metric === "km") {
      add("Km (run)", W.map(w => w.km_run), C.run);
      add("Km (bike)", W.map(w => w.km_ride), C.bike);
      add("Km (mixed)", W.map(w => w.km_mixed), C.mixed);
      add("Km (skate)", W.map(w => w.km_skate), C.skate);
    } else if (metric === "time") {
      add("Run", W.map(w => w.time_run_min), C.run);
      add("Bike", W.map(w => w.time_ride_min), C.bike);
      add("Strength", W.map(w => w.time_strength_min), C.strength);
      add("Mixed", W.map(w => w.time_mixed_min), C.mixed);
      add("Skate", W.map(w => w.time_skate_min), C.skate);
      add("Other", W.map(w => w.time_other_min), C.other);
    } else {
      add("TRIMP (run)", W.map(w => w.trimp_run), C.run);
      add("TRIMP (bike)", W.map(w => w.trimp_ride), C.bike);
      add("TRIMP (strength)", W.map(w => w.trimp_strength), C.strength);
      add("TRIMP (mixed)", W.map(w => w.trimp_mixed), C.mixed);
      add("TRIMP (skate)", W.map(w => w.trimp_skate), C.skate);
      add("TRIMP (other)", W.map(w => w.trimp_other), C.other);
    }

    ds.push({
      type: "line" as const, label: "Monotony", data: mono, yAxisID: "y1",
      borderColor: C.monotony, backgroundColor: C.monotony, tension: 0.3,
      pointRadius: 2, borderWidth: 2, spanGaps: true, order: 99,
    });
    ds.push({
      type: "line" as const, label: "Strain", data: strn, yAxisID: "y2",
      borderColor: C.strain, backgroundColor: C.strain, tension: 0.3,
      pointRadius: 2, borderWidth: 2, borderDash: [4, 4], spanGaps: true, order: 99,
    });

    return ds;
  }, [weeks, metric, mono, strn]);

  const data: ChartData<"bar" | "line", (number | null)[], string> = { labels, datasets };

  // dynamické maximum pre hlavnú (ľavú) os, aby vždy sedela
  const yMainMax = useMemo(() => {
    const arr =
      metric === "km"   ? weeks.map(w => Math.max(w.km_run, w.km_ride, w.km_mixed, w.km_skate))
    : metric === "time" ? weeks.map(w => Math.max(w.time_run_min, w.time_ride_min, w.time_strength_min, w.time_mixed_min, w.time_skate_min, w.time_other_min))
                        : weeks.map(w => Math.max(w.trimp_run, w.trimp_ride, w.trimp_strength, w.trimp_mixed, w.trimp_skate, w.trimp_other));
    const m = Math.max(1, ...arr, 0);
    return Math.ceil(m * 1.1);
  }, [weeks, metric]);

  // pravé osi – nech sa neprekrývajú (weight + padding) a majú farby kriviek
  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    datasets: { bar: { maxBarThickness: BAR.maxBarThickness, categoryPercentage: BAR.categoryPercentage, barPercentage: BAR.barPercentage } },
    elements: { point: { radius: 2, hitRadius: 8 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v.toFixed?.(2) ?? v}`;
            if (ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;
            if (metric === "km")   return `${label}: ${(v || 0).toFixed(1)} km`;
            if (metric === "time") return `${label}: ${Math.round(v)} min`;
            return `${label}: ${Math.round(v)} TRIMP`;
          },
        },
      },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index; if (idx == null) return;
      const w = weeks[idx]; if (!w) return;
      const pick = { week: w.week, start: w.start, end: w.end };
      setPicked(pick); onPickWeek?.(pick);
    },
    scales: {
      // ĽAVÁ – hlavná metrika
      y: {
        position: "left",
        beginAtZero: true,
        max: yMainMax,
        title: { display: true, text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP" },
        grid: { color: THEME.chart.grid },
        ticks: { color: "#cbd5e1" },
      },
      // PRAVÁ 1 – Monotony (zelená)
      y1: {
        position: "right",
        min: 0,
        max: 3,
        weight: 2,
        grid: { drawOnChartArea: false },
        ticks: { color: C.monotony, padding: 6 },
        title: { display: true, text: "Monotony", color: C.monotony },
      },
      // PRAVÁ 2 – Strain (žltá)
      y2: {
        position: "right",
        min: 0,
        // nech je vždy viditeľný (adaptívny strop podľa dát)
        max: Math.max(10, Math.ceil((strn.filter((v): v is number => Number.isFinite(v as number)) as number[]).reduce((m, v) => Math.max(m, v), 0) * 1.1)),
        weight: 1,
        grid: { drawOnChartArea: false },
        ticks: { color: C.strain, padding: 6 },
        title: { display: true, text: "Strain", color: C.strain },
      },
      x: { grid: { color: THEME.chart.gridSoft }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
    },
  };

  // výška: v landscape menšia, nech sa zmestí
  const chartHeight = isPortrait ? THEME.chart.weeklyHeight : 300;

  // pxPerLabel = konštantná šírka na 1 týždeň -> rovnaké bary ako vo widgete
  const PX_PER_LABEL = 26;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative">
      {/* ovládanie */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="opacity-70">Zobraziť:</span>
          <button onClick={() => setMetric("km")}   className={`px-2 py-1 rounded ${metric === "km"   ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Km</button>
          <button onClick={() => setMetric("time")} className={`px-2 py-1 rounded ${metric === "time" ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Čas</button>
          <button onClick={() => setMetric("trimp")}className={`px-2 py-1 rounded ${metric === "trimp"? "bg-blue-600 text-white" : "bg-gray-700"}`}>TRIMP</button>
        </div>
        <div className="text-xs">
          <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="px-2 py-1 rounded bg-gray-700">
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
            <option value={26}>26 týždňov</option>
          </select>
        </div>
      </div>

      {/* graf v scrolleri – žiadne pretekanie, fixné bary */}
      <ChartScroller labels={labels as string[]} height={chartHeight} pxPerLabel={PX_PER_LABEL}>
        <MixedChart type="bar" data={data} options={options} />
      </ChartScroller>

      {picked && (
        <WeeklySummary weeks={weeks as any} metric={metric} selectedWeek={picked.week} />
      )}
    </div>
  );
}
