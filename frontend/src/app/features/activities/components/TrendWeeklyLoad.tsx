"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend, Cell,
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
import { CARD, SURFACE_CARD_STYLE, PANEL_TITLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const DEFAULT_SPORT = "all" as const;

const formatTimeValue = (val: number) => {
  if (!val || val === 0) return "0:00";
  const h = Math.floor(val / 60);
  const m = Math.floor(val % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

/* ─── DIM COLOR — pre nevybraté bary (solídna farba, žiadna opacity) ─── */
// Mix farby smerom k tmavému pozadiu — nevybraté bary sú tlmené ale viditeľné
function dimColor(hex: string, amount = 0.78): string {
  if (!hex?.startsWith("#") || hex.length < 7) return hex;
  // Tmavé zelené pozadie aplikácie ~ rgb(7,22,16)
  const bg = [10, 24, 18];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number, bgc: number) => Math.round(c + (bgc - c) * amount);
  return `rgb(${mix(r, bg[0])}, ${mix(g, bg[1])}, ${mix(b, bg[2])})`;
}

/* ─── WEEK POPUP ─── */
const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun, ride: appColors.chartBike,
  strength: appColors.chartStrength, mixed: appColors.chartMixed,
  skate: appColors.chartSkate, other: appColors.chartOther,
};

function WeekPopup({ data, metric, t, onClose }: { data: any; metric: Metric; t: any; onClose: () => void }) {
  const fmt = (v: number) => metric === "time" ? formatTimeValue(v) : Number(v).toFixed(1);
  const sportName = (key: string) => ({
    run: t("common.sports.run"), ride: t("common.sports.bike"),
    strength: t("common.sports.strength"), mixed: t("common.sports.mixed"),
    skate: t("common.sports.skate"), other: t("common.sports.other"),
  }[key] ?? key);

  const entries = (["run","ride","strength","mixed","skate","other"] as const)
    .map((k) => ({ k, val: data[k] as number | undefined, color: SPORT_COLORS[k] }))
    .filter((e) => e.val && e.val > 0);
  const total = entries.reduce((s, e) => s + (e.val ?? 0), 0);

  return (
    <div style={{
      margin: "0 12px 8px 12px", padding: "10px 12px", borderRadius: 12,
      border: `1px solid ${appColors.panelBorder}`, backgroundColor: "rgba(9,24,18,0.95)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: appColors.textMuted }}>{data.label}</span>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: appColors.textMuted, fontSize: 16, lineHeight: 1, padding: "2px 4px", outline: "none",
        }}>✕</button>
      </div>
      {entries.map(({ k, val, color }) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: appColors.textMuted }}>{sportName(k)}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{fmt(val!)}</span>
        </div>
      ))}
      {entries.length > 1 && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginTop: 4, paddingTop: 6, borderTop: `1px solid ${appColors.divider}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textPrimary }}>
            {t("common.together") || "spolu"}:
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textPrimary }}>{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function TrendWeeklyLoad({
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
        const rows = await apiGetWeeklyLoad(userId, { weeks: lookback, sport: DEFAULT_SPORT });
        if (alive) setWeeks(rows);
      } catch { if (alive) setWeeks([]); }
      finally { if (alive) setLoading(false); }
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
        if (w.km_run > 0) hd.run = true; if (w.km_ride > 0) hd.ride = true;
        if (w.km_mixed > 0) hd.mixed = true; if (w.km_skate > 0) hd.skate = true;
      } else if (metric === "time") {
        row = { ...base, run: w.time_run_min, ride: w.time_ride_min, strength: w.time_strength_min, mixed: w.time_mixed_min, skate: w.time_skate_min, other: w.time_other_min };
        if (w.time_run_min > 0) hd.run = true; if (w.time_ride_min > 0) hd.ride = true;
        if (w.time_strength_min > 0) hd.strength = true; if (w.time_mixed_min > 0) hd.mixed = true;
        if (w.time_skate_min > 0) hd.skate = true; if (w.time_other_min > 0) hd.other = true;
      } else {
        row = { ...base, run: w.trimp_run, ride: w.trimp_ride, strength: w.trimp_strength, mixed: w.trimp_mixed, skate: w.trimp_skate, other: w.trimp_other };
        if (w.trimp_run > 0) hd.run = true; if (w.trimp_ride > 0) hd.ride = true;
        if (w.trimp_strength > 0) hd.strength = true; if (w.trimp_mixed > 0) hd.mixed = true;
        if (w.trimp_skate > 0) hd.skate = true; if (w.trimp_other > 0) hd.other = true;
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
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }
    setSelectedIndex(index);
    const w = chartData[index].rawWeek;
    if (onPickWeek && w?.start && w?.end)
      onPickWeek({ week: w.week || w.start || "", start: w.start, end: w.end, sport: "all" });
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
        const h = Math.floor(num / 60); const m = Math.floor(num % 60);
        return m === 0 ? `${h}h` : `${h}:${m.toString().padStart(2, "0")}`;
      }
      return `${num}m`;
    }
    return String(val);
  };

  const yAxisLabel = metric === "km" ? `[${t("common.units.km")}]`
    : metric === "time" ? `[h]` : `[trimp]`;

  const xAxisInterval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;

  /*
    Cells: SOLÍDNA farba (žiadna fillOpacity ktorá robí problémy).
    - nič nevybraté → plná farba
    - vybraný index → plná farba
    - ostatné → dimColor (tlmená solídna farba)
    key obsahuje selectedIndex → vynúti remount Cell → Recharts prekreslí
  */
  const renderCells = (baseColor: string, dataKey: string) =>
    chartData.map((_, i) => {
      const active = selectedIndex === null || selectedIndex === i;
      return (
        <Cell
          key={`${dataKey}-${i}-${selectedIndex ?? "none"}`}
          fill={active ? baseColor : dimColor(baseColor)}
        />
      );
    });

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>

      {/* Header */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h2 className={PANEL_TITLE}>{t("weeklyLoad.title")}</h2>
          {showLookback && (
            <SelectField value={String(lookback)} onValueChange={(v) => setLookback(Number(v))}
              options={WEEK_OPTIONS(t)} containerClassName="w-[110px]" variant="editable" />
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

      {/* Graf */}
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
          <BarChart data={chartData} onClick={handleChartClick}
            margin={{ top: 16, right: 8, left: 0, bottom: 4 }} style={{ outline: "none" }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            <XAxis dataKey="label" interval={xAxisInterval}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false} tickLine={false} dy={8} />
            <YAxis width={42} tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false} tickLine={false} tickFormatter={yAxisTickFormatter}
              label={{ value: yAxisLabel, angle: -90, position: "insideLeft",
                fill: appColors.textMuted, fontSize: 10, dx: 8, dy: 28 }} />

            {/* fill na Legend cez payload — explicitné farby aby bodky neboli čierne */}
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              payload={[
                ...(hasData.run      ? [{ value: t("common.sports.run"),      type: "circle" as const, color: appColors.chartRun }] : []),
                ...(hasData.ride     ? [{ value: t("common.sports.bike"),     type: "circle" as const, color: appColors.chartBike }] : []),
                ...(hasData.strength && (metric === "time" || metric === "trimp") ? [{ value: t("common.sports.strength"), type: "circle" as const, color: appColors.chartStrength }] : []),
                ...(hasData.mixed    ? [{ value: t("common.sports.mixed"),    type: "circle" as const, color: appColors.chartMixed }] : []),
                ...(hasData.skate    ? [{ value: t("common.sports.skate"),    type: "circle" as const, color: appColors.chartSkate }] : []),
                ...(hasData.other && (metric === "time" || metric === "trimp") ? [{ value: t("common.sports.other"), type: "circle" as const, color: appColors.chartOther }] : []),
              ]}
            />

            {hasData.run && (
              <Bar dataKey="run" name={t("common.sports.run") as string}
                stackId="a" fill={appColors.chartRun} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartRun, "run")}
              </Bar>
            )}
            {hasData.ride && (
              <Bar dataKey="ride" name={t("common.sports.bike") as string}
                stackId="a" fill={appColors.chartBike} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartBike, "ride")}
              </Bar>
            )}
            {hasData.strength && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="strength" name={t("common.sports.strength") as string}
                stackId="a" fill={appColors.chartStrength} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartStrength, "strength")}
              </Bar>
            )}
            {hasData.mixed && (
              <Bar dataKey="mixed" name={t("common.sports.mixed") as string}
                stackId="a" fill={appColors.chartMixed} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartMixed, "mixed")}
              </Bar>
            )}
            {hasData.skate && (
              <Bar dataKey="skate" name={t("common.sports.skate") as string}
                stackId="a" fill={appColors.chartSkate} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartSkate, "skate")}
              </Bar>
            )}
            {hasData.other && (metric === "time" || metric === "trimp") && (
              <Bar dataKey="other" name={t("common.sports.other") as string}
                stackId="a" fill={appColors.chartOther} maxBarSize={44} activeBar={false} isAnimationActive={false}>
                {renderCells(appColors.chartOther, "other")}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Popup pod grafom */}
      {selectedIndex !== null && chartData[selectedIndex] && (
        <WeekPopup data={chartData[selectedIndex]} metric={metric} t={t} onClose={handleDismiss} />
      )}
    </div>
  );
}
