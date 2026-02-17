// src/features/activity/components/TrendWeeklyLoad.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { OPTIONS, LOOKBACK_OPTIONS ,ensureChartJSRegistered} from "@/app/shared/charts/chart_builders";
import { useUserId } from "@/app/shared/hooks/useUserId";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";

import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyLoad } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
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
import { useT } from "@/app/shared/i18n/useT";

ensureChartJSRegistered();

const C = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  other: appColors.chartOther,
};

const DEFAULT_SPORT = "all" as const;

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
  const [lookback, setLookback] = useState<number>(2);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const t = useT();

  const _pxPerLabel = OPTIONS.weeklyPxPerLabel;
  const _height = OPTIONS.Height;
  const _legendPos = OPTIONS.legendPosition;
  const _maxBarThickness = OPTIONS.bar.maxThickness;
  const _categoryPercentage = OPTIONS.bar.categoryPct;
  const _barPercentage = OPTIONS.bar.barPct;

  useEffect(() => {
    onSportChange?.(DEFAULT_SPORT);
  }, [onSportChange]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyLoad(userId, {
          weeks: lookback,
          sport: DEFAULT_SPORT,
        });
        if (!alive) return;
        setWeeks(rows);
      } catch (e: any) {
        // Tiché logovanie
        console.error("Weekly load fetch failed:", t(e?.message as any));
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback, t]);

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);

  const datasets = useMemo(() => {
    const W = weeks;
    const ds: any[] = [];

    const pushBar = (
      key: "run" | "ride" | "strength" | "mixed" | "skate" | "other",
      label: string,
      data: number[],
    ) => {
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
      pushBar(
        "run",
        t("common.sports.run"),
        W.map((w) => w.km_run),
      );
      pushBar(
        "ride",
        t("common.sports.bike"),
        W.map((w) => w.km_ride),
      );
      pushBar(
        "mixed",
        t("common.sports.mixed"),
        W.map((w) => w.km_mixed),
      );
      pushBar(
        "skate",
        t("common.sports.skate"),
        W.map((w) => w.km_skate),
      );
    } else if (metric === "time") {
      pushBar(
        "run",
        t("common.sports.run"),
        W.map((w) => w.time_run_min),
      );
      pushBar(
        "ride",
        t("common.sports.bike"),
        W.map((w) => w.time_ride_min),
      );
      pushBar(
        "strength",
        t("common.sports.strength"),
        W.map((w) => w.time_strength_min),
      );
      pushBar(
        "mixed",
        t("common.sports.mixed"),
        W.map((w) => w.time_mixed_min),
      );
      pushBar(
        "skate",
        t("common.sports.skate"),
        W.map((w) => w.time_skate_min),
      );
      pushBar(
        "other",
        t("common.sports.other"),
        W.map((w) => w.time_other_min),
      );
    } else {
      pushBar(
        "run",
        t("common.sports.run"),
        W.map((w) => w.trimp_run),
      );
      pushBar(
        "ride",
        t("common.sports.bike"),
        W.map((w) => w.trimp_ride),
      );
      pushBar(
        "strength",
        t("common.sports.strength"),
        W.map((w) => w.trimp_strength),
      );
      pushBar(
        "mixed",
        t("common.sports.mixed"),
        W.map((w) => w.trimp_mixed),
      );
      pushBar(
        "skate",
        t("common.sports.skate"),
        W.map((w) => w.trimp_skate),
      );
      pushBar(
        "other",
        t("common.sports.other"),
        W.map((w) => w.trimp_other),
      );
    }

    return ds;
  }, [weeks, metric, t]);

  const data: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets,
  };

  const options: ChartOptions<"bar" | "line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      elements: { point: { radius: 2, hitRadius: 8 } },
      datasets: {
        bar: {
          maxBarThickness: _maxBarThickness,
          categoryPercentage: _categoryPercentage,
          barPercentage: _barPercentage,
        },
      },
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
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: appColors.chartAxis },
          title: {
            display: true,
            text:
              metric === "km"
                ? t("common.units.km")
                : metric === "time"
                  ? t("common.units.min")
                  : t("common.units.trimp"),
          },
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
    [
      metric,
      weeks,
      onPickWeek,
      _legendPos,
      _maxBarThickness,
      _categoryPercentage,
      _barPercentage,
      t
    ],
  );

  const minWidth = Math.max(320, Math.round(labels.length * _pxPerLabel));

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_CARD_HEAD].join(" ")}>
        <h2 className={PANEL_TITLE}>{t("weeklyLoad.title")}</h2>

        <div className={["ml-auto", PANEL_ACTIONS_INLINE].join(" ")}>
          <div className={PANEL_ACTIONS_INLINE}>
            <Button
              size="xs"
              variant={metric === "km" ? "active" : "editable"}
              onClick={() => setMetric("km")}
            >
              {t("common.metrics.distance")}
            </Button>
            <Button
              size="xs"
              variant={metric === "time" ? "active" : "editable"}
              onClick={() => setMetric("time")}
            >
              {t("common.metrics.time")}
            </Button>
            <Button
              size="xs"
              variant={metric === "trimp" ? "active" : "editable"}
              onClick={() => setMetric("trimp")}
            >
              {t("common.metrics.trimp")}
            </Button>
          </div>

          {showLookback && (
            <SelectField
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v))}
              options={LOOKBACK_OPTIONS(t)}
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
        <div className="relative" style={{ height: _height }}>
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