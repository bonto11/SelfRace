// src/features/activity/components/TrendWeeklyLoad.tsx
"use client";

import { useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { Metric } from "@/features/activity/utils/activity";
import { useActivityData } from "@/features/activity/data/ActivityDataContext";
import WeeklySummary from "@/features/activity/components/WeeklySummary";

ensureChartJSRegistered();

const C = {
  run:"#22D3EE", bike:"#A78BFA", strength:"#F59E0B", mixed:"#34D399", skate:"#60A5FA", other:"#9CA3AF",
  monotony:"#84CC16", strain:"#FDE047",
};

export type WeekPick = { week: string; start: string; end: string };

export default function TrendWeeklyLoad({ onPickWeek }: { onPickWeek?: (w: WeekPick) => void; }) {
  const { weeks } = useActivityData();

  const [metric, setMetric] = useState<Metric>("km");
  const [picked, setPicked] = useState<WeekPick | null>(null);

  const labels = useMemo(()=> weeks.map(w=>w.label || w.week), [weeks]);
  const mono   = useMemo(()=> weeks.map(w=> w.monotony[metric] ?? null), [weeks, metric]);
  const strn   = useMemo(()=> weeks.map(w=> w.strain[metric]   ?? null), [weeks, metric]);

  const monoMax = useMemo(() => {
    const vals = mono.filter((v): v is number => Number.isFinite(v as number));
    const m = vals.length ? Math.max(...vals) : 1.5;
    return Math.max(3, Math.ceil(m + 0.3));
  }, [mono]);

  const strainMax = useMemo(() => {
    const vals = strn.filter((v): v is number => Number.isFinite(v as number));
    const m = vals.length ? Math.max(...vals) : 100;
    return Math.ceil(m * 1.1);
  }, [strn]);

  const datasets = useMemo(() => {
    const ds:any[] = [];
    const pushBar = (label:string, data:number[], color:string) =>
      ds.push({ type:"bar" as const, label, data, backgroundColor:color, borderColor:color, borderWidth:1, yAxisID:"y" });

    if (metric === "km") {
      pushBar("Km (run)",   weeks.map(w=>w.km_run),   C.run);
      pushBar("Km (bike)",  weeks.map(w=>w.km_ride),  C.bike);
      pushBar("Km (mixed)", weeks.map(w=>w.km_mixed), C.mixed);
      pushBar("Km (skate)", weeks.map(w=>w.km_skate), C.skate);
    } else if (metric === "time") {
      pushBar("Run",      weeks.map(w=>w.time_run_min),      C.run);
      pushBar("Bike",     weeks.map(w=>w.time_ride_min),     C.bike);
      pushBar("Strength", weeks.map(w=>w.time_strength_min), C.strength);
      pushBar("Mixed",    weeks.map(w=>w.time_mixed_min),    C.mixed);
      pushBar("Skate",    weeks.map(w=>w.time_skate_min),    C.skate);
      pushBar("Other",    weeks.map(w=>w.time_other_min),    C.other);
    } else {
      // TRIMP – bude 0 ak API trimp neposiela; Monotony/Strain sa počíta len z dostupných (inak undefined)
      pushBar("TRIMP (run)",      weeks.map(w=>w.trimp_run),      C.run);
      pushBar("TRIMP (bike)",     weeks.map(w=>w.trimp_ride),     C.bike);
      pushBar("TRIMP (strength)", weeks.map(w=>w.trimp_strength), C.strength);
      pushBar("TRIMP (mixed)",    weeks.map(w=>w.trimp_mixed),    C.mixed);
      pushBar("TRIMP (skate)",    weeks.map(w=>w.trimp_skate),    C.skate);
      pushBar("TRIMP (other)",    weeks.map(w=>w.trimp_other),    C.other);
    }

    ds.push({ type:"line" as const, label:"Monotony", data:mono, yAxisID:"y1",
      borderColor:C.monotony, backgroundColor:C.monotony, tension:0.3, pointRadius:2, borderWidth:2, spanGaps:true, order:99 });
    ds.push({ type:"line" as const, label:"Strain", data:strn, yAxisID:"y2",
      borderColor:C.strain, backgroundColor:C.strain, tension:0.3, pointRadius:2, borderWidth:2, borderDash:[4,4], spanGaps:true, order:99 });

    return ds;
  }, [weeks, metric, mono, strn]);

  const data: ChartData<"bar"|"line",(number|null)[],string> = { labels, datasets };

  const options: ChartOptions<"bar"|"line"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 2, hitRadius: 8 } },
    datasets: { bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 } },
    layout: { padding: { bottom: 12 } },
    plugins: {
      legend: { position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 } },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index; if (idx == null) return;
      const w = weeks[idx]; if (!w) return;
      const pick = { week: w.week || w.label || w.start, start: w.start, end: w.end };
      setPicked(pick);
      console.log("[WEEK] picked ->", pick);
      onPickWeek?.(pick);
    },
    scales: {
      y:  { beginAtZero: true, position: "left",  grid: { color: THEME.chart.grid },
            title: { display: true, text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP" } },
      y1: { position: "right", min: 0, max: monoMax, grid: { drawOnChartArea: false },
            border: { color: C.monotony }, ticks: { color: C.monotony },
            title: { display: true, text: "Monotony", color: C.monotony } },
      y2: { position: "right", min: 0, max: strainMax, grid: { drawOnChartArea: false },
            border: { color: C.strain }, ticks: { color: C.strain },
            title: { display: true, text: "Strain", color: C.strain } },
      x:  { grid: { color: THEME.chart.gridSoft }, ticks: { autoSkip: true, minRotation: 55, maxRotation: 55, padding: 6, font: { size: 10 } } },
    },
  }), [metric, weeks, monoMax, strainMax, onPickWeek]);

  const minWidth = Math.max(320, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full min-w-0">
      {/* ovládanie */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="opacity-70">Zobraziť:</span>
          <button onClick={()=>setMetric("km")}    className={`px-2 py-1 rounded ${metric==="km"?"bg-blue-600 text-white":"bg-gray-700"}`}>Km</button>
          <button onClick={()=>setMetric("time")}  className={`px-2 py-1 rounded ${metric==="time"?"bg-blue-600 text-white":"bg-gray-700"}`}>Čas</button>
          <button onClick={()=>setMetric("trimp")} className={`px-2 py-1 rounded ${metric==="trimp"?"bg-blue-600 text-white":"bg-gray-700"}`}>TRIMP</button>
        </div>
      </div>

      {/* graf */}
      <div className="overflow-x-auto overflow-y-hidden rounded-md min-w-0" style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
        <div className="chart-fixed-h" style={{ height: THEME.chart.weeklyHeight }}>
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <MixedChart type="bar" data={data} options={options} />
          </div>
        </div>
      </div>

      {picked && (
        <WeeklySummary
          weeks={weeks as any}
          metric={metric}
          selectedWeek={picked.week}
        />
      )}
    </div>
  );
}