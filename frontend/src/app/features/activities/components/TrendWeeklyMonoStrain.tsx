"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { OPTIONS, LOOKBACK_OPTIONS, ensureChartJSRegistered } from "@/app/shared/charts/chart_builders";
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

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";

ensureChartJSRegistered();

// Použijeme farby z appColors
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
  const t = useT();

  const _pxPerLabel = OPTIONS.weeklyPxPerLabel;
  const _heightCompact = OPTIONS.HeightCompact;
  const _legendPos = OPTIONS.legendPosition;

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
      } catch (e: any) {
        console.error("Weekly mono/strain load failed:", e?.message);
        if (alive) setWeeks([]); 
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
          label: t("monoStrain.trend.mono"),
          data: mono,
          yAxisID: "y1",
          borderColor: C.monotony,
          backgroundColor: C.monotony,
          tension: 0.4, // Moderné plynulé krivky
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: true,
          order: 2,
        },
        {
          type: "line",
          label: t("monoStrain.trend.strain"),
          data: strn,
          yAxisID: "y2",
          borderColor: C.strain,
          backgroundColor: C.strain,
          tension: 0.4, // Moderné plynulé krivky
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
          borderDash: [5, 5],
          spanGaps: true,
          order: 1,
        },
      ],
    }),
    [labels, mono, strn, t],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { bottom: 12, left: 4, right: 4 } }, // Zmenšený padding
      plugins: {
        legend: {
          position: _legendPos,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
            padding: 10,
            font: { size: 11 },
          },
        },
        tooltip: {
          padding: 10,
          backgroundColor: appColors.panelBg,
          titleColor: appColors.textPrimary,
          bodyColor: appColors.textSecondary,
          borderColor: appColors.panelBorder,
          borderWidth: 1,
        }
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
          position: "left", // Monotónnosť vľavo
          beginAtZero: true,
          max: monoMax,
          grid: { color: appColors.chartAxis, drawOnChartArea: true },
          ticks: { color: C.monotony, padding: 6, font: { size: 10 } },
          title: { display: true, text: t("monoStrain.trend.mono"), color: C.monotony, font: { size: 10 } },
        },
        y2: {
          position: "right", // Úsilie presunuté napravo!
          beginAtZero: true,
          max: strainMax,
          grid: { drawOnChartArea: false }, // Vypnuté vnútorné čiary, nech nie je chaos
          ticks: { color: C.strain, padding: 6, font: { size: 10 } },
          title: { display: true, text: t("monoStrain.trend.strain"), color: C.strain, font: { size: 10 } },
        },
        x: {
          grid: { color: appColors.chartAxis, drawOnChartArea: false },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
            minRotation: 45,
            maxRotation: 45,
            padding: 6,
            font: { size: 10 },
          },
        },
      },
    }),
    [monoMax, strainMax, weeks, onPickWeek, _legendPos, t],
  );

  const height = Math.round(_heightCompact * 2);
  const minWidth = Math.max(320, Math.round(labels.length * _pxPerLabel));

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_CARD_HEAD].join(" ")}>
        <div className="flex items-center gap-2">
          <h2 className={PANEL_TITLE}>{t("monoStrain.trend.title")}</h2>
          <TooltipIcon text={t("monoStrain.trend.tooltip")} />
        </div>

        <div className={["ml-auto", PANEL_ACTIONS_INLINE].join(" ")}>
          <div className={PANEL_ACTIONS_INLINE}>
            <Button
              size="xs"
              variant={metric === "km" ? "active" : "editable"}
              onClick={() => setMetric("km")}
            >
              Km
            </Button>
            <Button
              size="xs"
              variant={metric === "time" ? "active" : "editable"}
              onClick={() => setMetric("time")}
            >
              Čas
            </Button>
            <Button
              size="xs"
              variant={metric === "trimp" ? "active" : "editable"}
              onClick={() => setMetric("trimp")}
            >
              TRIMP
            </Button>
          </div>

          {showLookback && (
            <SelectField
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v))}
              options={LOOKBACK_OPTIONS(t)}
              containerClassName="w-[130px] hidden sm:block" // Na mobiloch schováme alebo upravíme, zaberá miesto
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