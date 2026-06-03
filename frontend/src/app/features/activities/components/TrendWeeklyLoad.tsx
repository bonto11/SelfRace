"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";

import { WeekPick, Metric } from "@/app/features/activities/types/activities";
import { apiGetWeeklyLoad } from "@/app/features/activities/api/analytics_activities";
import { WeekRow } from "@/app/features/activities/types/WeeklyLoad";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD, SURFACE_CARD_STYLE, PANEL_PAD, PANEL_CARD_HEAD, PANEL_TITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const DEFAULT_SPORT = "all" as const;

const formatTimeValue = (val: number) => {
  if (!val || val === 0) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

/* ─── TOOLTIP ─── */
const StackedTooltip = ({ active, payload, label, metric, t, onDismiss }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum: number, e: any) => sum + (Number(e.value) || 0), 0);
  const fmt = (v: number) => metric === "time" ? formatTimeValue(v) : v.toFixed(1);

  return (
    // Klik na tooltip = dismiss
    <div
      onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
      className="p-3 rounded-xl border shadow-xl backdrop-blur-md min-w-[140px] cursor-pointer"
      style={{ backgroundColor: "rgba(9,24,18,0.95)", borderColor: appColors.panelBorder, outline: "none" }}
    >
      {/* Malý dismiss hint */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p className="text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        <span style={{ color: appColors.textMuted, fontSize: 12, lineHeight: 1 }}>✕</span>
      </div>

      <div className="space-y-1 mb-2">
        {payload.map((entry: any, i: number) => {
          if (!entry.value) return null;
          return (
            <div key={i} className="flex items-center justify-between gap-4 text-sm" style={{ color: entry.color }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="opacity-90">{entry.name}</span>
              </div>
              <span className="font-bold">{fmt(entry.value)}</span>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t flex justify-between items-center text-sm text-white/90 font-bold"
        style={{ borderColor: appColors.divider }}>
        <span>{t("common.together") || "spolu"}:</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
};

/* ─── CUSTOM BAR SHAPE — wider + dimmed ─── */
// Factory: returns shape renderer that knows selectedIndex via closure
function makeBarShape(selectedIndex: number | null, color: string) {
  return function BarShape(props: any) {
    const { x, y, width, height, index } = props;
    if (!height || height <= 0 || !width || width <= 0) return null;

    const isSelected = selectedIndex === index;
    const hasSelection = selectedIndex !== null;

    // Vybraný bar: +10px širší (±5 na každú stranu), ostatné: 35% opacity
    const extra     = isSelected ? 10 : 0;
    const opacity   = hasSelection && !isSelected ? 0.35 : 1;

    return (
      <rect
        x={x - extra / 2}
        y={y}
        width={Math.max(1, width + extra)}
        height={Math.max(1, height)}
        fill={color}
        fillOpacity={opacity}
        stroke="none"
        style={{ transition: "all 0.15s ease" }}
      />
    );
  };
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function TrendWeeklyLoad({
  onPickWeek,
  onSportChange,
  showLookback = true,
}: {
  onPickWeek?: (w: WeekPick | null) => void;
  onSportChange?: (sport: string) => void;
  showLookback?: boolean;
}) {
  const { userId } = useUserId();
  const [metric, setMetric]         = useState<Metric>("km");
  const [lookback, setLookback]     = useState<number>(2);
  const [weeks, setWeeks]           = useState<WeekRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const t = useT();

  useEffect(() => { onSportChange?.(DEFAULT_SPORT); }, [onSportChange]);

  // Reset výberu pri zmene dát
  useEffect(() => { setSelectedIndex(null); onPickWeek?.(null); }, [lookback, metric]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await apiGetWeeklyLoad(userId, { weeks: lookback, sport: DEFAULT_SPORT });
        if (alive) setWeeks(rows);
      } catch (e: any) {
        console.error("Weekly load fetch failed:", t(e?.message as any));
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback, t]);

  const { chartData, hasData } = useMemo(() => {
    const data = [];
    const hd = { run: false, ride: false, strength: false, mixed: false, skate: false, other: false };

    for (const w of weeks) {
      const base = { label: w.label || w.week, rawWeek: w };
      let row: any = { ...base };

      if (metric === "km") {
        row = { ...base, run: w.km_run, ride: w.km_ride, mixed: w.km_mixed, skate: w.km_skate };
        if (w.km_run > 0) hd.run = true;
        if (w.km_ride > 0) hd.ride = true;
        if (w.km_mixed > 0) hd.mixed = true;
        if (w.km_skate > 0) hd.skate = true;
      } else if (metric === "time") {
        row = { ...base, run: w.time_run_min, ride: w.time_ride_min, strength: w.time_strength_min, mixed: w.time_mixed_min, skate: w.time_skate_min, other: w.time_other_min };
        if (w.time_run_min > 0) hd.run = true;
        if (w.time_ride_min > 0) hd.ride = true;
        if (w.time_strength_min > 0) hd.strength = true;
        if (w.time_mixed_min > 0) hd.mixed = true;
        if (w.time_skate_min > 0) hd.skate = true;
        if (w.time_other_min > 0) hd.other = true;
      } else {
        row = { ...base, run: w.trimp_run, ride: w.trimp_ride, strength: w.trimp_strength, mixed: w.trimp_mixed, skate: w.trimp_skate, other: w.trimp_other };
        if (w.trimp_run > 0) hd.run = true;
        if (w.trimp_ride > 0) hd.ride = true;
        if (w.trimp_strength > 0) hd.strength = true;
        if (w.trimp_mixed > 0) hd.mixed = true;
        if (w.trimp_skate > 0) hd.skate = true;
        if (w.trimp_other > 0) hd.other = true;
      }
      data.push(row);
    }
    return { chartData: data, hasData: hd };
  }, [weeks, metric]);

  // Bar shapes — nové inštancie pri zmene selectedIndex (aby sa prekreslili)
  const barShapes = useMemo(() => ({
    run:      makeBarShape(selectedIndex, appColors.chartRun),
    ride:     makeBarShape(selectedIndex, appColors.chartBike),
    strength: makeBarShape(selectedIndex, appColors.chartStrength),
    mixed:    makeBarShape(selectedIndex, appColors.chartMixed),
    skate:    makeBarShape(selectedIndex, appColors.chartSkate),
    other:    makeBarShape(selectedIndex, appColors.chartOther),
  }), [selectedIndex]);

  const handleChartClick = (state: any) => {
    if (!state) return;
    const index = state.activeTooltipIndex ?? state.activeIndex;
    if (index === undefined || index === null || !chartData[index]) return;

    // Toggle — klik na vybraný = odznačiť
    if (selectedIndex === index) {
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }

    setSelectedIndex(index);
    const w = chartData[index].rawWeek;
    if (onPickWeek && w?.start && w?.end) {
      onPickWeek({ week: w.week || w.start || "", start: w.start, end: w.end, sport: "all" });
    }
  };

  const handleDismiss = () => {
    setSelectedIndex(null);
    onPickWeek?.(null);
  };

  const yAxisLabel = metric === "km"
    ? `[${t("common.units.km")}]`
    : metric === "time"
    ? `[${t("common.units.hour") || "h"}]`
    : `[${t("common.units.trimp")}]`;

  const yAxisTickFormatter = (val: any): string => {
    const num = Number(val);
    if (metric === "time") {
      if (num === 0) return "0";
      if (num >= 60) {
        const h = Math.floor(num / 60);
        const m = Math.floor(num % 60);
        return m === 0 ? `${h}h` : `${h}:${m.toString().padStart(2, "0")}`;
      }
      return `${num}m`;
    }
    return String(val);
  };

  // X-axis interval — pri veľa týždňoch ukaž menej tickov
  const xAxisInterval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>

      {/* ── Header: titul + metriky + select ── */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
        {/* Riadok 1: titul + select */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h2 className={PANEL_TITLE}>{t("weeklyLoad.title")}</h2>
          {showLookback && (
            <SelectField
              value={String(lookback)}
              onValueChange={(v) => setLookback(Number(v))}
              options={WEEK_OPTIONS(t)}
              containerClassName="w-[110px]"
              variant="editable"
            />
          )}
        </div>

        {/* Riadok 2: metriky — plná šírka */}
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
        className="w-full relative px-1 pb-3 focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none select-none"
        style={{ height: 380 }}
      >
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart
            data={chartData}
            onClick={handleChartClick}
            margin={{ top: 16, right: 8, left: 0, bottom: 4 }}
            style={{ outline: "none" }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />

            <XAxis
              dataKey="label"
              interval={xAxisInterval}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />

            {/*
              Y-os: width=42 aby [km] label neprekrýval čísla.
              label dx=-2 posúva text bližšie k osi.
            */}
            <YAxis
              width={42}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={yAxisTickFormatter}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                fill: appColors.textMuted,
                fontSize: 10,
                dx: 8,   // bližšie k osi (pozitívne = doprava = bližšie k číslam)
                dy: 28,
              }}
            />

            <Tooltip
              content={<StackedTooltip metric={metric} t={t} onDismiss={handleDismiss} />}
              cursor={{ fill: "transparent" }}
              wrapperStyle={{ outline: "none" }}
            />

            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />

            {/* Každý Bar dostane custom shape s logikou opacity + šírky */}
            {hasData.run && (
              <Bar dataKey="run" name={t("common.sports.run") as string}
                stackId="a" fill={appColors.chartRun}
                maxBarSize={44} radius={[0, 0, 0, 0]}
                shape={barShapes.run}
                activeBar={false}
              />
            )}
            {hasData.ride && (
              <Bar dataKey="ride" name={t("common.sports.bike") as string}
                stackId="a" fill={appColors.chartBike}
                maxBarSize={44} radius={[0, 0, 0, 0]}
                shape={barShapes.ride}
                activeBar={false}
              />
            )}
            {hasData.strength && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="strength" name={t("common.sports.strength") as string}
                stackId="a" fill={appColors.chartStrength}
                maxBarSize={44} radius={[0, 0, 0, 0]}
                shape={barShapes.strength}
                activeBar={false}
              />
            )}
            {hasData.mixed && (
              <Bar dataKey="mixed" name={t("common.sports.mixed") as string}
                stackId="a" fill={appColors.chartMixed}
                maxBarSize={44} radius={[0, 0, 0, 0]}
                shape={barShapes.mixed}
                activeBar={false}
              />
            )}
            {hasData.skate && (
              <Bar dataKey="skate" name={t("common.sports.skate") as string}
                stackId="a" fill={appColors.chartSkate}
                maxBarSize={44} radius={[0, 0, 0, 0]}
                shape={barShapes.skate}
                activeBar={false}
              />
            )}
            {hasData.other && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="other" name={t("common.sports.other") as string}
                stackId="a" fill={appColors.chartOther}
                maxBarSize={44} radius={[4, 4, 0, 0]}
                shape={barShapes.other}
                activeBar={false}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
