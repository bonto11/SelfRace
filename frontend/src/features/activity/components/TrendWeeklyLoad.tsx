// src/features/activity/components/TrendWeeklyLoad.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import Button from "@/shared/components/ui/Button";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";
export type WeekPick = { week: string; start: string; end: string; sport: string };

type WeekRow = {
  week: string;
  label: string;
  start: string;
  end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number;
  trimp_mixed: number; trimp_skate: number; trimp_other: number;
};

const C = {
  run: "#22D3EE",
  ride: "#A78BFA",
  strength: "#F59E0B",
  mixed: "#34D399",
  skate: "#60A5FA",
  other: "#9CA3AF",
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
  onSportChange,
  showLookback = true,
}: {
  onPickWeek?: (w: WeekPick) => void;
  onSportChange?: (sport: string) => void;
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const [metric, setMetric] = useState<Metric>("km");
  const [lookback, setLookback] = useState<number>(8);
  const [sport, setSport] = useState<string>("all");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { onSportChange?.(sport); }, [sport, onSportChange]);

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
          }))
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback, sport]);

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);

  const datasets = useMemo(() => {
    const W = weeks;
    const ds: any[] = [];
    const pushBar = (
      key: "run" | "ride" | "strength" | "mixed" | "skate" | "other",
      label: string,
      data: number[]
    ) => {
      if (sport !== "all" && sport !== key) return;
      const color = (C as any)[key];
      ds.push({
        type: "bar" as const,
        label,
        data,
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
        yAxisID: "y",
      });
    };

    if (metric === "km") {
      pushBar("run", "Km (run)", W.map((w) => w.km_run));
      pushBar("ride", "Km (ride)", W.map((w) => w.km_ride));
      pushBar("mixed", "Km (mixed)", W.map((w) => w.km_mixed));
      pushBar("skate", "Km (skate)", W.map((w) => w.km_skate));
    } else if (metric === "time") {
      pushBar("run", "Run", W.map((w) => w.time_run_min));
      pushBar("ride", "Ride", W.map((w) => w.time_ride_min));
      pushBar("strength", "Strength", W.map((w) => w.time_strength_min));
      pushBar("mixed", "Mixed", W.map((w) => w.time_mixed_min));
      pushBar("skate", "Skate", W.map((w) => w.time_skate_min));
      pushBar("other", "Other", W.map((w) => w.time_other_min));
    } else {
      pushBar("run", "TRIMP (run)", W.map((w) => w.trimp_run));
      pushBar("ride", "TRIMP (ride)", W.map((w) => w.trimp_ride));
      pushBar("strength", "TRIMP (strength)", W.map((w) => w.trimp_strength));
      pushBar("mixed", "TRIMP (mixed)", W.map((w) => w.trimp_mixed));
      pushBar("skate", "TRIMP (skate)", W.map((w) => w.trimp_skate));
      pushBar("other", "TRIMP (other)", W.map((w) => w.trimp_other));
    }

    return ds;
  }, [weeks, metric, sport]);

  const data: ChartData<"bar" | "line", number[], string> = { labels, datasets };

  const options: ChartOptions<"bar" | "line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      elements: { point: { radius: 2, hitRadius: 8 } },
      datasets: {
        bar: {
          maxBarThickness: THEME.chart.bar?.maxThickness ?? 12,
          categoryPercentage: THEME.chart.bar?.categoryPct ?? 0.6,
          barPercentage: THEME.chart.bar?.barPct ?? 0.7,
        },
      },
      layout: { padding: { bottom: 12 } },
      plugins: {
        legend: {
          position: THEME.chart.legendPosition,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
            padding: 10,
          },
        },
      },
      onClick: (_evt, els) => {
        const idx = els?.[0]?.index;
        if (idx == null) return;
        const w = weeks[idx];
        if (!w) return;
        onPickWeek?.({ week: w.week || w.label || w.start || "", start: w.start, end: w.end, sport });
      },
      scales: {
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: THEME.chart.grid },
          title: {
            display: true,
            text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP",
          },
        },
        x: {
          grid: { color: THEME.chart.gridSoft },
          ticks: { autoSkip: true, minRotation: 55, maxRotation: 55, padding: 6, font: { size: 10 } },
        },
      },
    }),
    [metric, weeks, onPickWeek, sport]
  );

  const minWidth = Math.max(320, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER – padding */}
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Týždňová záťaž</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button size="xs" variant={metric === "km" ? "secondary" : "ghost"} onClick={() => setMetric("km")}>Km</Button>
            <Button size="xs" variant={metric === "time" ? "secondary" : "ghost"} onClick={() => setMetric("time")}>Čas</Button>
            <Button size="xs" variant={metric === "trimp" ? "secondary" : "ghost"} onClick={() => setMetric("trimp")}>TRIMP</Button>
          </div>
          <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${inputClass} h-8 text-xs w-[130px]`}>
            <option value="all">Všetko</option>
            <option value="run">Run</option>
            <option value="ride">Ride</option>
            <option value="strength">Strength</option>
            <option value="mixed">Mixed</option>
            <option value="skate">Skate</option>
            <option value="other">Other</option>
          </select>
          {showLookback && (
            <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className={`${inputClass} h-8 text-xs w-[130px]`}>
              <option value={4}>4 týždne</option>
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
            </select>
          )}
        </div>
      </div>

      {/* BODY – flush + scroll */}
      <div className={`${SCROLL_X} min-w-0`} style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <MixedChart type="bar" data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}