"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import WeeklyLoadMini from "@/features/widgets/WeeklyLoadMini";
import ChartScroller from "@/features/widgets/ChartScroller";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";
export type WeekPick = { week: string; start: string; end: string };

type WeekRow = {
  week: string; label: string; start: string; end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number; km_total: number;
  time_min: number; time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number; trimp_mixed: number;
  trimp_skate: number; trimp_other: number; trimp: number;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

const C = {
  run: "#22D3EE", bike: "#A78BFA", strength: "#F59E0B",
  mixed: "#34D399", skate: "#60A5FA", other: "#9CA3AF",
  monotony: "#84CC16", strain: "#FDE047",
};
const a = (hex: string, alpha: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;

const fmtMin = (m: number) => {
  const mm = Math.round(m || 0);
  if (mm < 60) return `${mm} min`;
  const h = Math.floor(mm / 60), r = mm % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const fmtKm = (v: number) => `${(v || 0).toFixed(1)} km`;

type DetailRange = 4 | 12 | 52;
const isDecemberNow = () => new Date().getMonth() === 11;

export default function WeeklyLoadWidget({
  onPickWeek,
}: {
  onPickWeek?: (w: WeekPick) => void;
}) {
  const { userId } = useUserId();

  const [metric, setMetric] = useState<Metric>("km");
  const [detailOpen, setDetailOpen] = useState(false);
  const [range, setRange] = useState<DetailRange>(4); // 1 mesiac po otvorení
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedWeek, setPickedWeek] = useState<string | null>(null);
  const allowYear = isDecemberNow();

  // mini = vždy 2 týždne; detail = 4/12/(52 v decembri)
  const fetchSpan = detailOpen ? range : THEME.mobile.miniWeeks;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=${fetchSpan}`);
        const json = await res.json().catch(() => ({}));
        const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
        const norm: WeekRow[] = raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "", end: w.end ?? "",
          km_run: num(w.km_run ?? w.run_km),
          km_ride: num(w.km_ride ?? w.ride_km ?? w.km_bike),
          km_mixed: num(w.km_mixed),
          km_skate: num(w.km_skate),
          km_total: num(w.km_total ?? w.total_km),
          time_min: num(w.time_min ?? w.total_min),
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
          trimp: num(w.trimp ?? w.total_trimp),
          monotony: w.monotony ?? {},
          strain: w.strain ?? {},
        }));
        setWeeks(norm);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, fetchSpan]);

  // series
  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);
  const mono = useMemo(() => weeks.map((w) => w.monotony?.[metric] ?? null), [weeks, metric]);
  const strn = useMemo(() => weeks.map((w) => w.strain?.[metric] ?? null), [weeks, metric]);

  const monoMax = mono.some((v) => v != null) ? Math.max(1, ...mono.filter((v): v is number => v != null)) : 3;
  const strainMax = strn.some((v) => v != null) ? Math.max(1, ...strn.filter((v): v is number => v != null)) : 10;

  // datasets – bar rozmery priamo na datasetoch (bez TS chyby)
  const datasets = useMemo(() => {
    const W = weeks;
    const ds: any[] = [];
    const pushBar = (label: string, data: number[], color: string) =>
      ds.push({
        type: "bar" as const,
        label,
        data,
        backgroundColor: a(color, 0.85),
        borderColor: color,
        borderWidth: 1,
        yAxisID: "y",
        maxBarThickness: 12,
        categoryPercentage: 0.6,
        barPercentage: 0.7,
      });

    if (metric === "km") {
      pushBar("Km (run)", W.map((w) => w.km_run), C.run);
      pushBar("Km (bike)", W.map((w) => w.km_ride), C.bike);
      pushBar("Km (mixed)", W.map((w) => w.km_mixed), C.mixed);
      pushBar("Km (skate)", W.map((w) => w.km_skate), C.skate);
    } else if (metric === "time") {
      pushBar("Run", W.map((w) => w.time_run_min), C.run);
      pushBar("Bike", W.map((w) => w.time_ride_min), C.bike);
      pushBar("Strength", W.map((w) => w.time_strength_min), C.strength);
      pushBar("Mixed", W.map((w) => w.time_mixed_min), C.mixed);
      pushBar("Skate", W.map((w) => w.time_skate_min), C.skate);
      pushBar("Other", W.map((w) => w.time_other_min), C.other);
    } else {
      pushBar("TRIMP (run)", W.map((w) => w.trimp_run), C.run);
      pushBar("TRIMP (bike)", W.map((w) => w.trimp_ride), C.bike);
      pushBar("TRIMP (strength)", W.map((w) => w.trimp_strength), C.strength);
      pushBar("TRIMP (mixed)", W.map((w) => w.trimp_mixed), C.mixed);
      pushBar("TRIMP (skate)", W.map((w) => w.trimp_skate), C.skate);
      pushBar("TRIMP (other)", W.map((w) => w.trimp_other), C.other);
    }

    ds.push({
      type: "line" as const,
      label: "Monotony",
      data: mono,
      yAxisID: "y1",
      borderColor: C.monotony,
      backgroundColor: C.monotony,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 3,
      spanGaps: true,
      order: 99,
    });
    ds.push({
      type: "line" as const,
      label: "Strain",
      data: strn,
      yAxisID: "y2",
      borderColor: C.strain,
      backgroundColor: C.strain,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 3,
      borderDash: [4, 4],
      spanGaps: true,
      order: 99,
    });

    return ds;
  }, [weeks, metric, mono, strn]);

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: THEME.chart.legendPosition },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v.toFixed?.(2) ?? v}`;
            if (ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;
            if (metric === "km") return `${label}: ${fmtKm(v)}`;
            if (metric === "time") return `${label}: ${fmtMin(v)}`;
            return `${label}: ${Math.round(v)} TRIMP`;
          },
        },
      },
    },
    layout: { padding: { left: 8, right: 16 } },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index;
      if (idx == null) return;
      const row = weeks[idx];
      if (!row) return;
      setPickedWeek(row.week);
      onPickWeek?.({ week: row.week, start: row.start, end: row.end });
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP" },
        grid: { color: THEME.chart.grid },
      },
      y1: {
        position: "right",
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.5)),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Monotony" },
      },
      y2: {
        position: "right",
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain" },
      },
      x: { grid: { color: THEME.chart.gridSoft }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
    },
  };

  const data: ChartData<"bar" | "line", number[], string> = { labels, datasets };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full overflow-hidden">
      {/* Header (wrap) */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold">Weekly Load</h3>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-70">Zobraziť:</span>
            <button onClick={() => setMetric("km")} className={`px-2 py-1 rounded ${metric === "km" ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Km</button>
            <button onClick={() => setMetric("time")} className={`px-2 py-1 rounded ${metric === "time" ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Čas</button>
            <button onClick={() => setMetric("trimp")} className={`px-2 py-1 rounded ${metric === "trimp" ? "bg-blue-600 text-white" : "bg-gray-700"}`}>TRIMP</button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setDetailOpen((v) => !v)} className="text-xs px-2 py-1 rounded bg-gray-700">
              {detailOpen ? "Skryť detail" : "Detail"}
            </button>
            {detailOpen && (
              <div className="text-xs">
                <select
                  value={range}
                  onChange={(e) => setRange(Number(e.target.value) as DetailRange)}
                  className="px-2 py-1 rounded bg-gray-700"
                  title="Rozsah detailu"
                >
                  <option value={4}>1 mesiac</option>
                  <option value={12}>3 mesiace</option>
                  {allowYear && <option value={52}>Celý rok</option>}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Graf */}
      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : !detailOpen ? (
        <WeeklyLoadMini data={data} options={options} />
      ) : (
        <ChartScroller labels={data.labels as string[]} height={THEME.chart.weeklyHeight} pxPerLabel={26}>
          <MixedChart type="bar" data={data} options={options} />
        </ChartScroller>
      )}

      {pickedWeek && (
        <WeeklySummary weeks={weeks as any} metric={metric} selectedWeek={pickedWeek} />
      )}
    </div>
  );
}
