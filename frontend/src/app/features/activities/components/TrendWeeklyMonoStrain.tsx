// src/features/activity/components/TrendWeeklyMonoStrain.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { OPTIONS, LOOKBACK_OPTIONS } from "@/app/shared/charts/optionsActivity";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  SCROLL_X,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";
import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyMonoStrain } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/MonoStrain";

ensureChartJSRegistered();

const C = { monotony: appColors.chartLine1, strain: appColors.chartLine2 };
const DEFAULT_SPORT = "all" as const;

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
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  const _pxPerLabel = OPTIONS.weeklyPxPerLabel;
  const _heightCompact = OPTIONS.HeightCompact;
  const _legendPos = OPTIONS.legendPosition;

  // ak niekde vyššie počúvaš na sport, je to stále "all"
  useEffect(() => {
    onSportChange?.(DEFAULT_SPORT);
  }, [onSportChange]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyMonoStrain(userId, {
          weeks: lookback,
          sport: DEFAULT_SPORT,
        });
        if (!alive) return;
        setWeeks(rows);
      } catch (e) {
        console.error("Weekly mono/strain load failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback]);

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);
  const mono = useMemo(
    () => weeks.map((w) => w.monotony?.[metric] ?? null),
    [weeks, metric],
  );
  const strn = useMemo(
    () => weeks.map((w) => w.strain?.[metric] ?? null),
    [weeks, metric],
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
          label: "Monotónnosť",
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
          label: "Úsilie",
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
    [labels, mono, strn],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { bottom: 12 } },
      plugins: {
        legend: {
          position: _legendPos,
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
          sport: DEFAULT_SPORT,
        });
      },
      scales: {
        y1: {
          position: "left",
          weight: 2,
          min: 0,
          max: monoMax,
          grid: { color: appColors.chartAxis, drawOnChartArea: true },
          ticks: { color: C.monotony, padding: 8 },
          title: { display: true, text: "Monotónnosť", color: C.monotony },
        },
        y2: {
          position: "left",
          weight: 1,
          min: 0,
          max: strainMax,
          grid: { drawOnChartArea: false },
          ticks: { color: C.strain, padding: 36 },
          title: { display: true, text: "Úsilie", color: C.strain },
        },
        x: {
          grid: { color: appColors.chartAxis },
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
    [monoMax, strainMax, weeks, onPickWeek, _legendPos],
  );

  const height = Math.round(_heightCompact * 2);
  const minWidth = Math.max(320, Math.round(labels.length * _pxPerLabel));

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_CARD_HEAD].join(" ")}>
        <h2 className={PANEL_TITLE}>Monotónnosť & Strain</h2>

        {/* ✅ vždy vpravo */}
        <div className={["ml-auto", PANEL_ACTIONS_INLINE].join(" ")}>
          <div className={PANEL_ACTIONS_INLINE}>
            <Button
              size="xs"
              variant={metric === "km" ? "success" : "ghost"}
              onClick={() => setMetric("km")}
            >
              Km
            </Button>
            <Button
              size="xs"
              variant={metric === "time" ? "success" : "ghost"}
              onClick={() => setMetric("time")}
            >
              Čas
            </Button>
            <Button
              size="xs"
              variant={metric === "trimp" ? "success" : "ghost"}
              onClick={() => setMetric("trimp")}
            >
              TRIMP
            </Button>
          </div>

          {showLookback && (
            <SelectField
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v))}
              options={LOOKBACK_OPTIONS}
              containerClassName="w-[130px]"
              variant="editable"
              placeholder="—"
            />
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