// src/features/activity/components/TrendWeeklyMonoStrain.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import Button from "@/shared/components/ui/Button";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";
import type { WeekPick } from "@/features/activity/utils/activity";

import {
  apiGetWeeklyMonoStrain,
  type WeeklyMonoStrainRow,
} from "@/features/activity/api/activities";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";

type WeekRow = WeeklyMonoStrainRow;

const C = { monotony: THEME.chart.monotony, strain: THEME.chart.strain };

export default function TrendWeeklyMonoStrain({
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
  const [lookback, setLookback] = useState<number>(2);
  const [sport, setSport] = useState<string>("all");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onSportChange?.(sport);
  }, [sport, onSportChange]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyMonoStrain(userId, {
          weeks: lookback,
          sport,
        });
        if (!alive) return;
        setWeeks(rows);
      } catch (e) {
        // tu môžeš prípadne dorobiť toast/error log
        console.error("Weekly mono/strain load failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback, sport]);

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);
  const mono = useMemo(
    () => weeks.map((w) => w.monotony?.[metric] ?? null),
    [weeks, metric]
  );
  const strn = useMemo(
    () => weeks.map((w) => w.strain?.[metric] ?? null),
    [weeks, metric]
  );

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

  const data: ChartData<"line", (number | null)[], string> = useMemo(
    () => ({
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
    }),
    [labels, mono, strn]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
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
        onPickWeek?.({
          week: w.week || w.label || w.start || "",
          start: w.start,
          end: w.end,
          sport,
        });
      },
      scales: {
        y1: {
          position: "left",
          weight: 2,
          min: 0,
          max: monoMax,
          grid: { color: THEME.chart.grid, drawOnChartArea: true },
          ticks: { color: C.monotony, padding: 8 },
          title: { display: true, text: "Monotony", color: C.monotony },
        },
        y2: {
          position: "left",
          weight: 1,
          min: 0,
          max: strainMax,
          grid: { drawOnChartArea: false },
          ticks: { color: C.strain, padding: 36 },
          title: { display: true, text: "Strain", color: C.strain },
        },
        x: {
          grid: { color: THEME.chart.gridSoft },
          ticks: {
            autoSkip: true,
            minRotation: 55,
            maxRotation: 55,
            padding: 6,
            font: { size: 10 },
          },
        },
      },
    }),
    [monoMax, strainMax, weeks, onPickWeek, sport]
  );

  const baseHeight = THEME.chart.weeklyHeightCompact ?? 200;
  const height = Math.round(baseHeight * 2);
  const minWidth = Math.max(
    320,
    Math.round(labels.length * THEME.chart.weeklyPxPerLabel)
  );

  return (
    <div className={`${CARD} relative`}>
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Monotónnosť & Strain</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant={metric === "km" ? "secondary" : "ghost"}
              onClick={() => setMetric("km")}
            >
              Km
            </Button>
            <Button
              size="xs"
              variant={metric === "time" ? "secondary" : "ghost"}
              onClick={() => setMetric("time")}
            >
              Čas
            </Button>
            <Button
              size="xs"
              variant={metric === "trimp" ? "secondary" : "ghost"}
              onClick={() => setMetric("trimp")}
            >
              TRIMP
            </Button>
          </div>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className={`${inputClass} h-8 text-xs w-[130px]`}
          >
            <option value="all">Všetko</option>
            <option value="run">Run</option>
            <option value="ride">Ride</option>
            <option value="strength">Strength</option>
            <option value="mixed">Mixed</option>
            <option value="skate">Skate</option>
            <option value="other">Other</option>
          </select>
          {showLookback && (
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className={`${inputClass} h-8 text-xs w-[130px]`}
            >
              <option value={2}>2 týždne</option>
              <option value={4}>4 týždne</option>
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
            </select>
          )}
        </div>
      </div>

      <div
        className={`${SCROLL_X} min-w-0`}
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}