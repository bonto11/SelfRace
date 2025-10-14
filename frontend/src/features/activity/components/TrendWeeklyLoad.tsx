"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import { THEME } from "@/shared/theme/tokens";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";
type WeekRow = {
  week: string; label: string; start: string; end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number; trimp_mixed: number; trimp_skate: number; trimp_other: number;
  monotony: { km?: number; time?: number; trimp?: number };
  strain:    { km?: number; time?: number; trimp?: number };
};

const C = {
  run:"#22D3EE", bike:"#A78BFA", strength:"#F59E0B", mixed:"#34D399", skate:"#60A5FA", other:"#9CA3AF",
  monotony:"#84CC16", strain:"#FDE047",
};

export type WeekPick = { week: string; start: string; end: string };

export default function TrendWeeklyLoad({ onPickWeek }: { onPickWeek?: (w: WeekPick) => void; }) {
  const { userId } = useUserId();

  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(8);          // 4 / 8 / 12
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [picked, setPicked] = useState<WeekPick | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=${lookback}`);
      const json = await res.json().catch(() => ({}));
      const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
      const num = (v:any)=> (Number.isFinite(+v) ? +v : 0);
      setWeeks(raw.map((w)=>({
        week: w.week ?? w.iso_week ?? w.label ?? "",
        label: w.label ?? w.week ?? w.iso_week ?? "",
        start: w.start ?? "", end: w.end ?? "",
        km_run: num(w.km_run ?? w.run_km),  km_ride: num(w.km_ride ?? w.ride_km ?? w.km_bike),
        km_mixed: num(w.km_mixed),         km_skate: num(w.km_skate),
        time_run_min: num(w.time_run_min ?? w.run_min),
        time_ride_min: num(w.time_ride_min ?? w.ride_min),
        time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
        time_mixed_min: num(w.time_mixed_min),
        time_skate_min: num(w.time_skate_min),
        time_other_min: num(w.time_other_min ?? w.other_min),
        trimp_run: num(w.trimp_run ?? w.run_trimp),
        trimp_ride: num(w.trimp_ride ?? w.bike_trimp),
        trimp_strength: num(w.trimp_strength ?? w.strength_trimp),
        trimp_mixed: num(w.trimp_mixed),
        trimp_skate: num(w.trimp_skate),
        trimp_other: num(w.trimp_other ?? w.other_trimp),
        monotony: w.monotony ?? {}, strain: w.strain ?? {},
      })));
    })();
  }, [userId, lookback]);

  const labels = useMemo(()=>weeks.map(w=>w.label || w.week), [weeks]);
  const mono   = useMemo(()=>weeks.map(w=>w.monotony?.[metric] ?? null), [weeks, metric]);
  const strn   = useMemo(()=>weeks.map(w=>w.strain?.[metric]   ?? null), [weeks, metric]);

  // maxy pre pravé osi
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
    const W = weeks;
    const ds:any[] = [];
    const pushBar = (label:string, data:number[], color:string) =>
      ds.push({ type:"bar" as const, label, data, backgroundColor:color, borderColor:color, borderWidth:1, yAxisID:"y" });

    if (metric === "km") {
      pushBar("Km (run)",   W.map(w=>w.km_run),   C.run);
      pushBar("Km (bike)",  W.map(w=>w.km_ride),  C.bike);
      pushBar("Km (mixed)", W.map(w=>w.km_mixed), C.mixed);
      pushBar("Km (skate)", W.map(w=>w.km_skate), C.skate);
    } else if (metric === "time") {
      pushBar("Run",      W.map(w=>w.time_run_min),      C.run);
      pushBar("Bike",     W.map(w=>w.time_ride_min),     C.bike);
      pushBar("Strength", W.map(w=>w.time_strength_min), C.strength);
      pushBar("Mixed",    W.map(w=>w.time_mixed_min),    C.mixed);
      pushBar("Skate",    W.map(w=>w.time_skate_min),    C.skate);
      pushBar("Other",    W.map(w=>w.time_other_min),    C.other);
    } else {
      pushBar("TRIMP (run)",      W.map(w=>w.trimp_run),      C.run);
      pushBar("TRIMP (bike)",     W.map(w=>w.trimp_ride),     C.bike);
      pushBar("TRIMP (strength)", W.map(w=>w.trimp_strength), C.strength);
      pushBar("TRIMP (mixed)",    W.map(w=>w.trimp_mixed),    C.mixed);
      pushBar("TRIMP (skate)",    W.map(w=>w.trimp_skate),    C.skate);
      pushBar("TRIMP (other)",    W.map(w=>w.trimp_other),    C.other);
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
    datasets: { bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 } }, // == widget
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
            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v.toFixed(2)}`;
            if (ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;
            if (metric === "km")   return `${label}: ${v.toFixed(1)} km`;
            if (metric === "time") return `${label}: ${Math.round(v)} min`;
            return `${label}: ${Math.round(v)} TRIMP`;
          },
        },
      },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index; if (idx == null) return;
      const w = weeks[idx]; if (!w) return;
      const pick = { week:w.week, start:w.start, end:w.end };
      setPicked(pick);
      onPickWeek?.(pick);
    },
    // ľavá os = km/min/TRIMP, pravé dve = Monotony + Strain (farby podľa čiar)
    scales: {
      y:  { beginAtZero: true, position: "left",  grid: { color: THEME.chart.grid },
            title: { display: true, text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP" } },
      y1: { position: "right", min: 0, max: monoMax, grid: { drawOnChartArea: false },
            border: { color: C.monotony }, ticks: { color: C.monotony },
            title: { display: true, text: "Monotony", color: C.monotony } },
      y2: { position: "right", min: 0, max: strainMax, grid: { drawOnChartArea: false },
            border: { color: C.strain }, ticks: { color: C.strain },
            title: { display: true, text: "Strain", color: C.strain } },
      x:  { grid: { color: THEME.chart.gridSoft }, ticks: { maxRotation: 0, autoSkip: true } },
    },
  }), [metric, weeks, monoMax, strainMax, onPickWeek]);

  // konzistentná hrúbka barov + horizontálny scroll len vo vnútri
  const minWidth = Math.max(320, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full min-w-0">
      {/* header filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="opacity-70">Zobraziť:</span>
          <button onClick={()=>setMetric("km")}    className={`px-2 py-1 rounded ${metric==="km"?"bg-blue-600 text-white":"bg-gray-700"}`}>Km</button>
          <button onClick={()=>setMetric("time")}  className={`px-2 py-1 rounded ${metric==="time"?"bg-blue-600 text-white":"bg-gray-700"}`}>Čas</button>
          <button onClick={()=>setMetric("trimp")} className={`px-2 py-1 rounded ${metric==="trimp"?"bg-blue-600 text-white":"bg-gray-700"}`}>TRIMP</button>
        </div>
        <div className="text-xs">
          <select value={lookback} onChange={(e)=>setLookback(Number(e.target.value))} className="px-2 py-1 rounded bg-gray-700">
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
      </div>

      {/* scroll only inside */}
      <div className="relative">
        {/* “frozen” osi – len vizuálne lišty, prekryjú scrollujúci obsah pri okrajoch */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-gray-800/80 to-transparent border-r border-gray-700/60 z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-gray-800/80 to-transparent border-l border-gray-700/60 z-10" />

        <div
          className="overflow-x-auto overflow-y-hidden rounded-md min-w-0"
          style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
        >
          <div className="chart-fixed-h" style={{ height: THEME.chart.weeklyHeight }}>
            <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
              <MixedChart type="bar" data={data} options={options} />
            </div>
          </div>
        </div>
      </div>

      {picked && <WeeklySummary weeks={weeks as any} metric={metric} selectedWeek={picked.week} />}
    </div>
  );
}
