// src/features/activity/components/TrendWeeklyMonoStrain.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";

type WeekRow = {
  label: string;
  start: string; end: string;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

const C = { monotony: "#84CC16", strain: "#FDE047" };

export default function TrendWeeklyMonoStrain() {
  const { userId } = useUserId();
  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(8);
  const [sport, setSport] = useState<string>("all");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/analytics/weekly/${userId}?weeks=${lookback}&sport=${sport}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        if (!alive) return;
        setWeeks(
          raw.map((w) => ({
            label: w.label ?? w.week ?? "",
            start: w.start ?? "",
            end: w.end ?? "",
            monotony: w.monotony ?? {},
            strain: w.strain ?? {},
          }))
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback, sport]);

  const labels = useMemo(() => weeks.map((w) => w.label), [weeks]);
  const mono = useMemo(() => weeks.map((w) => w.monotony?.[metric] ?? null), [weeks, metric]);
  const strn = useMemo(() => weeks.map((w) => w.strain?.[metric] ?? null), [weeks, metric]);

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

  const data: ChartData<"line", (number | null)[], string> = useMemo(() => ({
    labels,
    datasets: [
      {
        type: "line",
        label: "Monotony",
        data: mono,
        yAxisID: "y1",
        borderColor: C.monotony,
        backgroundColor: C.monotony,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        spanGaps: true,
        order: 2,
      },
      {
        type: "line",
        label: "Strain",
        data: strn,
        yAxisID: "y2",
        borderColor: C.strain,
        backgroundColor: C.strain,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        borderDash: [4, 4],
        spanGaps: true,
        order: 2,
      },
    ],
  }), [labels, mono, strn]);

  const options: ChartOptions<"line"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { bottom: 12 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
    },
    scales: {
      y1: {
        position: "right",
        min: 0,
        max: monoMax,
        grid: { drawOnChartArea: false },
        border: { color: C.monotony },
        ticks: { color: C.monotony },
        title: { display: true, text: "Monotony", color: C.monotony },
      },
      y2: {
        position: "right",
        min: 0,
        max: strainMax,
        grid: { drawOnChartArea: false },
        border: { color: C.strain },
        ticks: { color: C.strain },
        title: { display: true, text: "Strain", color: C.strain },
      },
      x: { grid: { color: THEME.chart.gridSoft }, ticks: { minRotation: 55, maxRotation: 55, padding: 6, font: { size: 10 } } },
    },
  }), [monoMax, strainMax]);

  const minWidth = Math.max(320, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));
  const height = THEME.chart.weeklyHeightCompact ?? 200;

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER – padding */}
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Monotónnosť & Strain</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button className={`${inputClass} h-8 text-xs px-3`} onClick={() => setMetric("km")}>Km</button>
            <button className={`${inputClass} h-8 text-xs px-3`} onClick={() => setMetric("time")}>Čas</button>
            <button className={`${inputClass} h-8 text-xs px-3`} onClick={() => setMetric("trimp")}>TRIMP</button>
          </div>
          <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className={`${inputClass} h-8 text-xs w-[130px]`}>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${inputClass} h-8 text-xs w-[130px]`}>
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

      {/* BODY – flush + scroll */}
      <div className={`${SCROLL_X} min-w-0`} style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
        <div className="relative" style={{ height }}>
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
    </div>
  );
}