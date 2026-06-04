"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD, SURFACE_CARD_STYLE, PANEL_TITLE,
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

/* ─── TOOLTIP ─── */
const CustomTooltip = ({ active, payload, label, metric, t }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md"
      style={{ backgroundColor: "rgba(9,24,18,0.92)", borderColor: appColors.panelBorder }}>
      <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
      {payload.map((entry: any, i: number) => {
        let val = Number(entry.value).toFixed(2);
        if (entry.dataKey === "strain" && metric === "time") val = formatTimeValue(entry.value);
        return (
          <div key={i} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="opacity-90">{entry.name}:</span>
            <span className="font-bold">{val}</span>
          </div>
        );
      })}
    </div>
  );
};

/* ─── HLAVNÝ KOMPONENT ─── */
export default function TrendWeeklyMonoStrain({
  onPickWeek, onSportChange, showLookback = true,
}: {
  onPickWeek?: (w: WeekPick | null) => void;
  onSportChange?: (sport: string) => void;
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const [metric, setMetric]               = useState<Metric>("km");
  const [lookback, setLookback]           = useState<number>(2);
  const [weeks, setWeeks]                 = useState<WeekRow[]>([]);
  const [loading, setLoading]             = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const t = useT();

  useEffect(() => { onSportChange?.(DEFAULT_SPORT); }, [onSportChange]);
  useEffect(() => { setSelectedIndex(null); onPickWeek?.(null); }, [lookback, metric]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyMonoStrain(userId, { weeks: lookback, sport: DEFAULT_SPORT });
        if (alive) setWeeks(rows);
      } catch (e: any) {
        console.error("Weekly mono/strain load failed:", e?.message);
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback]);

  const chartData = useMemo(() => weeks.map((w) => ({
    label: w.label || w.week,
    mono: w.monotony?.[metric] ?? null,
    strain: w.strain?.[metric] ?? null,
    rawWeek: w,
  })), [weeks, metric]);

  const handleChartClick = useCallback((state: any) => {
    if (!state) return;
    const raw = state.activeTooltipIndex ?? state.activeIndex;
    if (raw === undefined || raw === null) return;
    const index = Number(raw);
    if (!Number.isInteger(index) || !chartData[index]) return;

    if (selectedIndex === index) {
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }
    setSelectedIndex(index);
    const w = chartData[index].rawWeek;
    if (w?.start && w?.end)
      onPickWeek?.({ week: w.week || w.start || "", start: w.start, end: w.end, sport: "all" });
  }, [selectedIndex, chartData, onPickWeek]);

  const yAxisTickFormatter = (val: any): string => {
    if (metric === "time") {
      const num = Number(val);
      if (num === 0) return "0";
      if (num >= 60) {
        const h = Math.floor(num / 60); const m = Math.floor(num % 60);
        return m === 0 ? `${h}h` : `${h}:${m.toString().padStart(2, "0")}`;
      }
      return `${num}m`;
    }
    return String(val);
  };

  const rightAxisUnit = metric === "km" ? `[${t("common.units.km")}]`
    : metric === "time" ? `[h]` : `[${t("common.units.trimp")}]`;

  const xAxisInterval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;

  const selectedLabel = selectedIndex !== null ? chartData[selectedIndex]?.label : null;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
        {/* Riadok 1: titul + tooltip info + select */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <h2 className={PANEL_TITLE}>{t("monoStrain.trend.title")}</h2>
            <TooltipIcon text={t("monoStrain.trend.tooltip")} />
          </div>
          {showLookback && (
            <SelectField value={String(lookback)} onValueChange={(v) => setLookback(Number(v))}
              options={WEEK_OPTIONS(t)} containerClassName="w-[110px]" variant="editable" />
          )}
        </div>
        {/* Riadok 2: metriky */}
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="xs" variant={metric === "km" ? "active" : "editable"} onClick={() => setMetric("km")}>
            {t("common.metrics.distance")}
          </Button>
          <Button size="xs" variant={metric === "time" ? "active" : "editable"} onClick={() => setMetric("time")}>
            {t("common.metrics.time")}
          </Button>
          <Button size="xs" variant={metric === "trimp" ? "active" : "editable"} onClick={() => setMetric("trimp")}>
            {t("common.metrics.trimp")}
          </Button>
        </div>
      </div>

      {/* ── Graf ── */}
      <div
        className="w-full relative px-1 pb-3 select-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none"
        style={{ height: 340 }}
      >
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <LineChart data={chartData} onClick={handleChartClick}
            margin={{ top: 16, right: 16, left: 0, bottom: 4 }} style={{ outline: "none" }}>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />

            <XAxis
              dataKey="label"
              interval={xAxisInterval}
              axisLine={false} tickLine={false} dy={8}
              tick={(props: any) => {
                const { x, y, payload, index } = props;
                const isSelected = selectedIndex === index;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={14} textAnchor="middle"
                      fill={isSelected ? appColors.brandPrimary : appColors.textMuted}
                      fontWeight={isSelected ? 700 : 400} fontSize={10}>
                      {payload.value}
                    </text>
                  </g>
                );
              }}
            />

            <YAxis yAxisId="left" width={38}
              tick={{ fill: C.monotony, fontSize: 10 }}
              axisLine={false} tickLine={false}
              label={{ value: "[-]", angle: -90, position: "insideLeft",
                fill: appColors.textMuted, fontSize: 10, dx: 8, dy: 20 }} />

            <YAxis yAxisId="right" orientation="right" width={42}
              tick={{ fill: C.strain, fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={yAxisTickFormatter}
              label={{ value: rightAxisUnit, angle: 90, position: "insideRight",
                fill: appColors.textMuted, fontSize: 10, dx: -8, dy: 28 }} />

            <Tooltip content={<CustomTooltip metric={metric} t={t} />}
              cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "4 4" }}
              wrapperStyle={{ outline: "none" }} />

            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

            {/* Zvislá referenčná čiara pre vybraný týždeň — funguje spoľahlivo v LineChart */}
            {selectedLabel && (
              <ReferenceLine
                yAxisId="left"
                x={selectedLabel}
                stroke={appColors.brandPrimary}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.8}
              />
            )}

            <Line yAxisId="left" type="monotone" dataKey="mono"
              name={t("monoStrain.trend.mono") as string}
              stroke={C.monotony} strokeWidth={3}
              dot={{ r: 3, fill: C.monotony, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: "none" }} connectNulls />

            <Line yAxisId="right" type="monotone" dataKey="strain"
              name={t("monoStrain.trend.strain") as string}
              stroke={C.strain} strokeWidth={3} strokeDasharray="5 5"
              dot={{ r: 3, fill: C.strain, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: "none" }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
