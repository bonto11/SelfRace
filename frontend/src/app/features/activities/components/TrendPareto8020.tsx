"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  SPORT_OPTIONS, PARETO_DEFAULT_SET,
  normalizeSport, sportsToCSV, isInParetoDefault,
} from "@/app/configs/config_sports";

import {
  WeeklyCard, WeeksControl, Readout, Legend, dimShape, clickedIndex, xTick, fmtMinutes,
} from "@/app/features/activities/components/WeeklyChartParts";

import type { ParetoWeekPick, ParetoRow } from "@/app/features/activities/types/pareto";
import { apiFetchParetoTrend } from "@/app/features/activities/api/analytics_activities";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type Lookback = 2 | 4 | 8 | 12;
// zemité tóny overené validátorom (dataviz) – rovnaké ako trendy
const C = { easy: appColors.chartRecoveryMain, hard: appColors.chartRecoveryAlt };

/* ─── COMPACT SPORT PICKER ─── */
function SportPicker({
  visibleSportsOptions,
  selectedSports,
  onToggle,
  t,
}: {
  visibleSportsOptions: { value: string; label: string }[];
  selectedSports: string[];
  onToggle: (s: string) => void;
  t: any;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Zatvoriť pri kliku mimo
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Label tlačidla: "Beh, Bike" alebo "Beh, Bike +2"
  const activeLabels = visibleSportsOptions
    .filter((opt) => selectedSports.map(normalizeSport).includes(normalizeSport(opt.value) ?? ""))
    .map((opt) => opt.label);
  const btnLabel =
    activeLabels.length === 0
      ? t("pareto8020.trend.pickSports") || "Športy"
      : activeLabels.length <= 2
      ? activeLabels.join(", ")
      : `${activeLabels.slice(0, 2).join(", ")} +${activeLabels.length - 2}`;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger tlačidlo */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 20,
          border: `1px solid ${appColors.panelBorder}`,
          backgroundColor: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
          color: appColors.textPrimary,
          fontSize: 12, cursor: "pointer", outline: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span>{btnLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown so checkboxmi */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          zIndex: 50, minWidth: 180,
          backgroundColor: appColors.panelBg,
          border: `1px solid ${appColors.panelBorder}`,
          borderRadius: 12, padding: "8px 4px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {visibleSportsOptions.map((opt) => {
            const norm = normalizeSport(opt.value) ?? "";
            const active = selectedSports.map(normalizeSport).includes(norm);
            const isDefault = isInParetoDefault(norm);
            return (
              <label key={opt.value}
                onClick={() => onToggle(opt.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 12px", cursor: "pointer", borderRadius: 8,
                  backgroundColor: active ? "rgba(255,255,255,0.06)" : "transparent",
                }}
              >
                {/* Custom checkbox */}
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${active ? appColors.brandPrimary : appColors.panelBorder}`,
                  backgroundColor: active ? appColors.brandPrimary : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {active && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span style={{ fontSize: 13, color: active ? appColors.textPrimary : appColors.textMuted }}>
                  {opt.label}
                </span>
                {!isDefault && (
                  <span style={{ fontSize: 10, color: appColors.textMuted, marginLeft: "auto", opacity: 0.6 }}>
                    *
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
/*
 * PREČO 100 % stĺpce + kĺzavá čiara: týždenné percentá samé osebe skáču
 * (jeden pretek prevráti týždeň), 80/20 sa posudzuje dlhodobo. Stĺpce
 * ukazujú skladbu týždňa, čiara kĺzavý podiel ľahkej záťaže za 4 týždne
 * (počíta BE z minút) a prerušovaná čiara cieľ 80 %. Jedna os (%).
 */
const TARGET_EASY = 80;
/** od koľko % kĺzavého podielu ľahkej záťaže je mix v poriadku */
const OK_EASY = 75;

export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: ParetoWeekPick | null) => void;
}) {
  const { userId } = useUserId();
  const t = useT();
  const [lookback, setLookback] = useState<Lookback>(2);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedSports, setSelectedSports] = useState<string[]>(Array.from(PARETO_DEFAULT_SET));
  const [rows, setRows] = useState<ParetoRow[]>([]);
  const [availableSports, setAvailableSports] = useState<string[]>([]);

  const sportCsv = useMemo(() => {
    const csv = sportsToCSV(selectedSports);
    return !csv || csv === "all" ? null : csv;
  }, [selectedSports]);

  // Reset výberu pri zmene filtra
  useEffect(() => { setSelectedIndex(null); onPickWeek?.(null); }, [lookback, sportCsv]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiFetchParetoTrend(userId, lookback, sportCsv);
        if (!alive) return;
        setRows(res.trend as ParetoRow[]);
        if (res.availableSports?.length) setAvailableSports(res.availableSports);
      } catch (e: any) {
        console.error("Pareto trend fetch failed:", e?.message);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, lookback, sportCsv]);

  const chartData = useMemo(
    () =>
      rows.map((r) => {
        const total = (r.easy_min || 0) + (r.hard_min || 0);
        return {
          label: r.label,
          // prázdny týždeň = žiadny stĺpec (nie 0 % ľahkej záťaže)
          easy_pct: total ? r.easy_pct : null,
          hard_pct: total ? r.hard_pct : null,
          rolling: r.rolling_easy_pct ?? null,
          rawRow: r,
        };
      }),
    [rows],
  );

  const visibleSportsOptions = useMemo(() => {
    if (!availableSports.length) return SPORT_OPTIONS;
    return SPORT_OPTIONS.filter((opt) => {
      const norm = normalizeSport(opt.value);
      return norm && availableSports.includes(norm);
    });
  }, [availableSports]);

  const toggleSport = (s: string) => {
    const n = normalizeSport(s);
    if (!n || n === "all") return;
    setSelectedSports((prev) => {
      const set = new Set(prev.map(normalizeSport).filter(Boolean) as string[]);
      set.has(n) ? set.delete(n) : set.add(n);
      return Array.from(set);
    });
  };

  useEffect(() => {
    if (selectedSports.length === 0) setSelectedSports(Array.from(PARETO_DEFAULT_SET));
  }, [selectedSports.length]);

  const pick = useCallback((index: number | null) => {
    if (index == null || !chartData[index] || index === selectedIndex) {
      setSelectedIndex(null);
      onPickWeek?.(null);
      return;
    }
    setSelectedIndex(index);
    const r = chartData[index].rawRow;
    if (r?.start && r?.end) onPickWeek?.({ start: r.start, end: r.end, sport: "all" });
  }, [selectedIndex, chartData, onPickWeek]);

  // bez výberu: posledný týždeň (aktuálny stav 80/20)
  const lastIdx = chartData.length - 1;
  const shownIdx = selectedIndex ?? (lastIdx >= 0 ? lastIdx : null);
  const shown = shownIdx != null ? chartData[shownIdx] : null;
  const raw = shown?.rawRow;

  const status =
    shown?.rolling == null
      ? null
      : shown.rolling >= OK_EASY
        ? t("pareto8020.trend.inRange")
        : t("pareto8020.trend.outRange");

  const readout = shown ? (
    <Readout
      heading={selectedIndex != null ? shown.label : `${t("weeklyCharts.thisWeek")} · ${shown.label}`}
      onClear={selectedIndex != null ? () => pick(null) : undefined}
    >
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
        <span className="text-2xl font-bold tabular-nums" style={{ color: appColors.textPrimary }}>
          {shown.rolling != null ? `${shown.rolling} %` : "—"}
        </span>
        <span className="text-xs" style={{ color: appColors.textSecondary }}>
          {t("pareto8020.trend.rollingLabel")}
        </span>
      </div>
      {status ? (
        <div className="text-xs mt-0.5" style={{ color: appColors.textSecondary }}>
          {status}
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums" style={{ color: appColors.textSecondary }}>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C.easy }} />
          {t("pareto8020.trend.labelEasy")}: {shown.easy_pct ?? 0} % · {fmtMinutes(raw?.easy_min || 0)} h
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: C.hard }} />
          {t("pareto8020.trend.labelHard")}: {shown.hard_pct ?? 0} % · {fmtMinutes(raw?.hard_min || 0)} h
        </span>
      </div>
    </Readout>
  ) : null;

  return (
    <WeeklyCard
      title={t("pareto8020.trend.title")}
      tooltip={t("pareto8020.widget.tooltip")}
      loading={loading}
      controls={
        <div className="space-y-2">
          <WeeksControl value={lookback} onChange={(w) => setLookback(w as Lookback)} />
          <SportPicker
            visibleSportsOptions={visibleSportsOptions}
            selectedSports={selectedSports}
            onToggle={toggleSport}
            t={t}
          />
        </div>
      }
      readout={readout}
      footer={
        <Legend
          items={[
            { label: t("pareto8020.trend.labelEasy"), color: C.easy },
            { label: t("pareto8020.trend.labelHard"), color: C.hard },
            { label: t("pareto8020.trend.rollingLabel"), color: appColors.textPrimary, kind: "line" },
            { label: t("pareto8020.trend.labelEasyRef"), color: appColors.brandPrimary, kind: "dash" },
          ]}
        />
      }
    >
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <ComposedChart
            data={chartData}
            onClick={(s: any) => pick(clickedIndex(s))}
            margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
            style={{ outline: "none", cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke={appColors.chartGrid} strokeOpacity={0.35} strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              interval={lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2}
              axisLine={false}
              tickLine={false}
              tick={xTick(selectedIndex != null ? chartData[selectedIndex]?.label ?? null : null)}
            />
            <YAxis
              width={50}
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v} %`}
            />
            <Bar dataKey="easy_pct" stackId="p" fill={C.easy} maxBarSize={44}
              shape={dimShape(selectedIndex)} activeBar={false} isAnimationActive={false} />
            <Bar dataKey="hard_pct" stackId="p" fill={C.hard} maxBarSize={44}
              shape={dimShape(selectedIndex)} activeBar={false} isAnimationActive={false} />
            <ReferenceLine y={TARGET_EASY} stroke={appColors.brandPrimary} strokeDasharray="5 4" strokeWidth={1.5} />
            <Line
              type="monotone"
              dataKey="rolling"
              stroke={appColors.textPrimary}
              strokeWidth={2.5}
              dot={{ r: 3, fill: appColors.textPrimary, stroke: appColors.surfaceSolid, strokeWidth: 2 }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </WeeklyCard>
  );
}
