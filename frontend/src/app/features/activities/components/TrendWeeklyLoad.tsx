"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend,
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
  CARD, SURFACE_CARD_STYLE, PANEL_TITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const DEFAULT_SPORT = "all" as const;

const formatTimeValue = (val: number) => {
  if (!val || val === 0) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

/* ─── VLASTNÝ POPUP (nie Recharts Tooltip) ─── */
interface WeekPopupProps {
  data: any;
  metric: Metric;
  t: any;
  onClose: () => void;
}

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  other: appColors.chartOther,
};

function WeekPopup({ data, metric, t, onClose }: WeekPopupProps) {
  const fmt = (v: number) =>
    metric === "time" ? formatTimeValue(v) : Number(v).toFixed(1);

  const entries = (["run","ride","strength","mixed","skate","other"] as const)
    .map((key) => ({ key, val: data[key] as number | undefined, color: SPORT_COLORS[key] }))
    .filter((e) => e.val && e.val > 0);

  const total = entries.reduce((s, e) => s + (e.val ?? 0), 0);

  const sportName = (key: string) => {
    const map: Record<string, string> = {
      run:      t("common.sports.run"),
      ride:     t("common.sports.bike"),
      strength: t("common.sports.strength"),
      mixed:    t("common.sports.mixed"),
      skate:    t("common.sports.skate"),
      other:    t("common.sports.other"),
    };
    return map[key] ?? key;
  };

  return (
    <div
      style={{
        margin: "0 12px 8px 12px",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${appColors.panelBorder}`,
        backgroundColor: "rgba(9,24,18,0.95)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Header: týždeň + zavriť */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: appColors.textMuted }}>
          {data.label}
        </span>
        {/* Zavriť — naše tlačidlo, plná kontrola */}
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: appColors.textMuted, fontSize: 16, lineHeight: 1,
            padding: "2px 4px", outline: "none",
          }}
        >
          ✕
        </button>
      </div>

      {/* Položky */}
      {entries.map(({ key, val, color }) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: appColors.textMuted }}>{sportName(key)}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: color }}>{fmt(val!)}</span>
        </div>
      ))}

      {/* Spolu */}
      {entries.length > 1 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 4, paddingTop: 6,
          borderTop: `1px solid ${appColors.divider}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textPrimary }}>
            {t("common.together") || "spolu"}:
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textPrimary }}>
            {fmt(total)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── STABLE BAR SHAPES cez useRef (bez remountingu) ─── */
// Ref drží selectedIndex — shape funkcie sú stable (prázdne deps [])
// ale vždy čítajú aktuálnu hodnotu z ref.
function useBarShapes(selectedIndexRef: React.MutableRefObject<number | null>) {
  return useMemo(() => {
    const make = (color: string) =>
      function BarShape(props: any) {
        const { x, y, width, height, index } = props;
        if (!height || height <= 0 || !width) return null;

        const sel = selectedIndexRef.current;
        const isSelected = sel === index;
        const hasSel = sel !== null;
        // Vybraný: +10px širší; ostatné: 35% opacity
        const extra   = isSelected ? 10 : 0;
        const opacity = hasSel && !isSelected ? 0.35 : 1;

        return (
          <rect
            x={x - extra / 2}
            y={y}
            width={Math.max(1, width + extra)}
            height={Math.max(1, height)}
            fill={color}
            fillOpacity={opacity}
            stroke="none"
          />
        );
      };

    return {
      run:      make(appColors.chartRun),
      ride:     make(appColors.chartBike),
      strength: make(appColors.chartStrength),
      mixed:    make(appColors.chartMixed),
      skate:    make(appColors.chartSkate),
      other:    make(appColors.chartOther),
    };
  }, []); // prázdne deps = stable referencie = žiadny remounting
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

  // Ref pre stable bar shapes — synchronizovaný v každom renderi
  const selectedIndexRef = useRef<number | null>(null);
  selectedIndexRef.current = selectedIndex; // vždy aktuálne

  const barShapes = useBarShapes(selectedIndexRef);

  useEffect(() => { onSportChange?.(DEFAULT_SPORT); }, [onSportChange]);
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
        if (alive) setWeeks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback]);

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

  const handleChartClick = useCallback((state: any) => {
    if (!state) return;
    const index = state.activeTooltipIndex ?? state.activeIndex;
    if (index === undefined || index === null || !chartData[index]) return;

    if (selectedIndex === index) {
      // Rovnaký bar = odznačiť
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }

    setSelectedIndex(index);
    const w = chartData[index].rawWeek;
    if (onPickWeek && w?.start && w?.end) {
      onPickWeek({ week: w.week || w.start || "", start: w.start, end: w.end, sport: "all" });
    }
  }, [selectedIndex, chartData, onPickWeek]);

  const handleDismiss = useCallback(() => {
    setSelectedIndex(null);
    onPickWeek?.(null);
  }, [onPickWeek]);

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

  const yAxisLabel = metric === "km"
    ? `[${t("common.units.km")}]`
    : metric === "time" ? `[h]` : `[trimp]`;

  const xAxisInterval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
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
        className="w-full relative px-1 select-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none"
        style={{ height: 360 }}
      >
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
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
              axisLine={false} tickLine={false} dy={8}
            />

            <YAxis
              width={42}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={yAxisTickFormatter}
              label={{ value: yAxisLabel, angle: -90, position: "insideLeft",
                fill: appColors.textMuted, fontSize: 10, dx: 8, dy: 28 }}
            />

            {/* BEZ <Tooltip> — popup renderujeme sami */}

            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

            {hasData.run && (
              <Bar dataKey="run" name={t("common.sports.run") as string}
                stackId="a" fill={appColors.chartRun}
                maxBarSize={44} shape={barShapes.run} activeBar={false} />
            )}
            {hasData.ride && (
              <Bar dataKey="ride" name={t("common.sports.bike") as string}
                stackId="a" fill={appColors.chartBike}
                maxBarSize={44} shape={barShapes.ride} activeBar={false} />
            )}
            {hasData.strength && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="strength" name={t("common.sports.strength") as string}
                stackId="a" fill={appColors.chartStrength}
                maxBarSize={44} shape={barShapes.strength} activeBar={false} />
            )}
            {hasData.mixed && (
              <Bar dataKey="mixed" name={t("common.sports.mixed") as string}
                stackId="a" fill={appColors.chartMixed}
                maxBarSize={44} shape={barShapes.mixed} activeBar={false} />
            )}
            {hasData.skate && (
              <Bar dataKey="skate" name={t("common.sports.skate") as string}
                stackId="a" fill={appColors.chartSkate}
                maxBarSize={44} shape={barShapes.skate} activeBar={false} />
            )}
            {hasData.other && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="other" name={t("common.sports.other") as string}
                stackId="a" fill={appColors.chartOther}
                maxBarSize={44} shape={barShapes.other} activeBar={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Vlastný popup pod grafom — plná kontrola nad zavretím ── */}
      {selectedIndex !== null && chartData[selectedIndex] && (
        <WeekPopup
          data={chartData[selectedIndex]}
          metric={metric}
          t={t}
          onClose={handleDismiss}
        />
      )}
    </div>
  );
}