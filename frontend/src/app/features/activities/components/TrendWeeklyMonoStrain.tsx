"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
} from "@/app/shared/ui/tokens";
import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyMonoStrain } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/MonoStrain";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";

const C = { monotony: appColors.chartLine1, strain: appColors.chartLine2 };
const DEFAULT_SPORT = "all" as const;

const formatTimeValue = (val: number) => {
  if (!val || val === 0) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

const CustomTooltip = ({ active, payload, label, metric, t }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md"
        style={{
          backgroundColor: "rgba(9, 24, 18, 0.92)",
          borderColor: appColors.panelBorder,
        }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>
          {label}
        </p>

        {payload.map((entry: any, index: number) => {
          let formattedValue = Number(entry.value).toFixed(2);

          if (entry.dataKey === "strain" && metric === "time") {
            formattedValue = formatTimeValue(entry.value);
          }

          return (
            <div
              key={index}
              className="flex items-center gap-2 text-sm"
              style={{ color: entry.color }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></span>
              <span className="opacity-90">{entry.name}:</span>
              <span className="font-bold">{formattedValue}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

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

  const chartData = useMemo(() => {
    return weeks.map((w) => ({
      label: w.label || w.week,
      mono: w.monotony?.[metric] ?? null,
      strain: w.strain?.[metric] ?? null,
      rawWeek: w,
    }));
  }, [weeks, metric]);

  const handleChartClick = (state: any) => {
  
    if (!onPickWeek) {
      console.warn("❌ [MonoStrain] onPickWeek chýba (neprišlo z parenta)!");
      return;
    }

    if (!state) {
      console.warn("⚠️ [MonoStrain] state je null (klikol si mimo bodu).");
      return;
    }
    
    // Zistíme index. Pre LineChart je activeTooltipIndex oveľa spoľahlivejší pri kliku než activePayload!
    const index = state.activeTooltipIndex !== undefined ? state.activeTooltipIndex : state.activeIndex;

    if (index !== undefined && index !== null && chartData[index]) {
      const w = chartData[index].rawWeek;

      if (w && w.start && w.end) {
        const payload = {
          week: w.week || w.start || "",
          start: w.start,
          end: w.end,
          sport: "all",
        };

        onPickWeek(payload);
      } else {
        console.error("❌ [MonoStrain] rawWeek nemá start alebo end!", w);
      }
    } else {
      console.warn("⚠️ [MonoStrain] Index je neplatný alebo neexistuje v chartData.");
    }
  };

  const yAxisTickFormatter = (val: any, index: number): string => {
    if (metric === "time") {
      const num = Number(val);
      if (num === 0) return "0";
      if (num >= 60) {
        const h = Math.floor(num / 60);
        const m = Math.floor(num % 60);
        return m === 0
          ? `${h}${t("common.units.hour") || "h"}`
          : `${h}:${m.toString().padStart(2, "0")}`;
      }
      return `${num}${t("common.units.min") || "m"}`;
    }
    return String(val);
  };

  const rightAxisUnit =
    metric === "km"
      ? `[${t("common.units.km")}]`
      : metric === "time"
        ? `[${t("common.units.hour") || "h"}]`
        : `[${t("common.units.trimp")}]`;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div
        className={[PANEL_PAD, PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}
      >
        <div className="flex items-center gap-2">
          <h2 className={PANEL_TITLE}>{t("monoStrain.trend.title")}</h2>
          <TooltipIcon text={t("monoStrain.trend.tooltip")} />
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-1 p-1 rounded-lg">
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
              options={WEEK_OPTIONS(t)}
              containerClassName="w-[120px]"
              variant="editable"
            />
          )}
        </div>
      </div>

      <div
        className="w-full relative px-2 sm:px-4 pb-4 select-none focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none"
        style={{ height: 320 }}
      >
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart
            data={chartData}
            onClick={handleChartClick}
            margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
            style={{ outline: "none" }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={appColors.chartGrid}
            />

            <XAxis
              dataKey="label"
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />

            <YAxis
              yAxisId="left"
              tick={{ fill: C.monotony, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "[-]",
                angle: -90,
                position: "insideLeft",
                fill: appColors.textMuted,
                fontSize: 10,
                dy: 30,
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: C.strain, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisTickFormatter}
              label={{
                value: rightAxisUnit,
                angle: 90,
                position: "insideRight",
                fill: appColors.textMuted,
                fontSize: 10,
                dy: 30,
              }}
            />

            <Tooltip
              content={<CustomTooltip metric={metric} t={t} />}
              cursor={{ stroke: "transparent" }}
              wrapperStyle={{ outline: "none" }}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="mono"
              name={t("monoStrain.trend.mono") as string}
              stroke={C.monotony}
              strokeWidth={3}
              dot={{ r: 3, fill: C.monotony, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: "none" }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="strain"
              name={t("monoStrain.trend.strain") as string}
              stroke={C.strain}
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: C.strain, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: "none" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}