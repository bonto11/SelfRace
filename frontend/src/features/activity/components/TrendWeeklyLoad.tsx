"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/icons/LoadingSpinner";
ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";
export type WeekPick = { week: string; start: string; end: string; sport: string };

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
  run:"#22D3EE", ride:"#A78BFA", strength:"#F59E0B", mixed:"#34D399", skate:"#60A5FA", other:"#9CA3AF",
  monotony:"#84CC16", strain:"#FDE047",
};

function rangeLabel(start?: string, end?: string) {
  if (!start || !end) return "";
  const s = new Date(start), e = new Date(end);
  const sd = s.getDate(), sm = s.getMonth() + 1;
  const ed = e.getDate(), em = e.getMonth() + 1;
  return sm === em ? `${sd}–${ed}.${em}.` : `${sd}.${sm}.–${ed}.${em}.`;
}

export default function TrendWeeklyLoad({
  onPickWeek,
  onSportChange,          // ← NEW
  showLookback = true,
}: {
  onPickWeek?: (w: WeekPick) => void;
  onSportChange?: (sport: string) => void;  // ← NEW
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const [metric, setMetric]   = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(8);
  const [sport, setSport]     = useState<string>("all");
  const [weeks, setWeeks]     = useState<WeekRow[]>([]);
  const [picked, setPicked]   = useState<WeekPick | null>(null);
  const [loading, setLoading] = useState(false);
  
  // notify parent on sport switch (kvôli tabuľke)
  useEffect(() => {
    console.debug("[WEEK][sport change] ->", sport);
    onSportChange?.(sport);
  }, [sport, onSportChange]);

  // fetch (zohľadňuje sport)
  useEffect(() => {
  if (!userId) return;
  let alive = true;
  (async () => {
    setLoading(true); // NEW
    try {
      const url = `${API_URL}/analytics/weekly/${userId}?weeks=${lookback}&sport=${sport}`;
      console.debug("[WEEK][fetch]", url);
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const raw: any[] = Array.isArray(json?.weeks)
        ? json.weeks
        : Array.isArray(json?.data)
        ? json.data
        : [];
      const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
      if (!alive) return;
      setWeeks(
        raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: rangeLabel(w.start, w.end) || w.label || w.week || "",
          start: w.start ?? "",
          end: w.end ?? "",
          km_run: num(w.km_run ?? w.run_km),
          km_ride: num(w.km_ride ?? w.ride_km),
          km_mixed: num(w.km_mixed),
          km_skate: num(w.km_skate),
          time_run_min: num(w.time_run_min ?? w.run_min),
          time_ride_min: num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_mixed_min: num(w.time_mixed_min),
          time_skate_min: num(w.time_skate_min),
          time_other_min: num(w.time_other_min ?? w.other_min),
          trimp_run: num(w.trimp_run ?? w.run_trimp),
          trimp_ride: num(w.trimp_ride ?? w.ride_trimp),
          trimp_strength: num(w.trimp_strength ?? w.strength_trimp),
          trimp_mixed: num(w.trimp_mixed),
          trimp_skate: num(w.trimp_skate),
          trimp_other: num(w.trimp_other ?? w.other_trimp),
          monotony: w.monotony ?? {},
          strain: w.strain ?? {},
        }))
      );
    } finally {
      if (alive) setLoading(false); // NEW
    }
  })();
  return () => {
    alive = false;
  };
}, [userId, lookback, sport]);

  const labels = useMemo(()=>weeks.map(w=>w.label || w.week), [weeks]);
  const mono   = useMemo(()=>weeks.map(w=>w.monotony?.[metric] ?? null), [weeks, metric]);
  const strn   = useMemo(()=>weeks.map(w=>w.strain?.[metric]   ?? null), [weeks, metric]);

  const monoMax = useMemo(() => {
    const vals = mono.filter((v): v is number => Number.isFinite(v as number));
    const m = vals.length ? Math.max(...vals) : 1.5;
    return Math.max(3, Math.ceil(m + 0.3));
  }, [mono]);

  const strainMax = useMemo(() => {
    const vals = strn.filter((v): v is number => Number.isFinite(v as number));
    const m = vals.length ? Math.max(...vals) : 80;
    return Math.ceil(m * 1.1);
  }, [strn]);

  // zostavenie datasetov + CLIENT-SIDE FILTER podľa sport
  const datasets = useMemo(() => {
    const W = weeks;
    const ds:any[] = [];
    const pushBar = (key:"run"|"ride"|"strength"|"mixed"|"skate"|"other", label:string, data:number[]) => {
      // ak je vybraný konkrétny sport, necháme len jeho dataset
      if (sport !== "all" && sport !== key) return;
      const color = (C as any)[key];
      ds.push({ type:"bar" as const, label, data, backgroundColor:color, borderColor:color, borderWidth:1, yAxisID:"y" });
    };

    if (metric === "km") {
      pushBar("run","Km (run)",   W.map(w=>w.km_run));
      pushBar("ride","Km (ride)", W.map(w=>w.km_ride));
      pushBar("mixed","Km (mixed)",W.map(w=>w.km_mixed));
      pushBar("skate","Km (skate)",W.map(w=>w.km_skate));
    } else if (metric === "time") {
      pushBar("run","Run",      W.map(w=>w.time_run_min));
      pushBar("ride","Ride",     W.map(w=>w.time_ride_min));
      pushBar("strength","Strength", W.map(w=>w.time_strength_min));
      pushBar("mixed","Mixed",    W.map(w=>w.time_mixed_min));
      pushBar("skate","Skate",    W.map(w=>w.time_skate_min));
      pushBar("other","Other",    W.map(w=>w.time_other_min));
    } else {
      pushBar("run","TRIMP (run)",      W.map(w=>w.trimp_run));
      pushBar("ride","TRIMP (ride)",     W.map(w=>w.trimp_ride));
      pushBar("strength","TRIMP (strength)", W.map(w=>w.trimp_strength));
      pushBar("mixed","TRIMP (mixed)",    W.map(w=>w.trimp_mixed));
      pushBar("skate","TRIMP (skate)",    W.map(w=>w.trimp_skate));
      pushBar("other","TRIMP (other)",    W.map(w=>w.trimp_other));
    }

    ds.push({ type:"line" as const, label:"Monotony", data:mono, yAxisID:"y1",
      borderColor:C.monotony, backgroundColor:C.monotony, tension:0.3, pointRadius:2, borderWidth:2, spanGaps:true, order:99 });
    ds.push({ type:"line" as const, label:"Strain", data:strn, yAxisID:"y2",
      borderColor:C.strain, backgroundColor:C.strain, tension:0.3, pointRadius:2, borderWidth:2, borderDash:[4,4], spanGaps:true, order:99 });

    console.debug("[WEEK][datasets]", { metric, sport, bars: ds.filter(d=>d.type==="bar").map(d=>d.label) });
    return ds;
  }, [weeks, metric, mono, strn, sport]);

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
      const key = w.week || w.label || w.start || "";
      const pick = { week: key, start: w.start, end: w.end, sport };
      console.debug("[WEEK][pick]", pick);
      setPicked(pick);
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
      x:  { grid: { color: THEME.chart.gridSoft },
            ticks: { autoSkip: true, minRotation: 55, maxRotation: 55, padding: 6, font: { size: 10 } } },
    },
  }), [metric, weeks, monoMax, strainMax, onPickWeek, sport]);

  const minWidth = Math.max(320, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));

  return (
  <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full min-w-0">
    {/* header */}
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

      <div className="flex items-center gap-2 text-xs">
        <select
          className="px-2 py-1 rounded bg-gray-700 text-white"
          value={lookback}
          onChange={(e) => setLookback(Number(e.target.value) as 4 | 8 | 12)}
        >
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>

        <select
          className="px-2 py-1 rounded bg-gray-700 text-white"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option value="all">Všetko</option>
          <option value="run">Run</option>
          <option value="ride">Ride</option>
          <option value="strength">Strength</option>
          <option value="mixed">Mixed</option>
          <option value="skate">Skate</option>
          <option value="other">Other</option>
        </select>
      </div>
    </div>

    {/* graf + overlay spinner */}
    <div className="overflow-x-auto rounded-md" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="relative" style={{ height: 240 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
          <LineChart type="line" data={data} options={options} />
        </div>
      </div>
    </div>

    {/* detail vybraného týždňa */}
    <div className="mt-2 text-xs opacity-80">
      {picked ? (
        <>
          <div className="font-semibold">{picked.label}</div>
          <div>
            Easy: {fmtSecondsHMS(picked.easy_min || 0)} ({Math.round(picked.easy_pct)}%) {" • "}
            Hard: {fmtSecondsHMS(picked.hard_min || 0)} ({Math.round(picked.hard_pct)}%)
          </div>
        </>
      ) : (
        <div>Klikni na bod v grafe pre zobrazenie detailu týždňa.</div>
      )}
    </div>
  </div>
);
}