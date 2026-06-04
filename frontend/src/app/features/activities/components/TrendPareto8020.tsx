"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import {
  SPORT_OPTIONS, PARETO_DEFAULT_SET,
  normalizeSport, sportsToCSV, isInParetoDefault,
} from "@/app/configs/config_sports";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import { CARD, SURFACE_CARD_STYLE, PANEL_TITLE } from "@/app/shared/ui/tokens";

import type { ParetoWeekPick, ParetoRow } from "@/app/features/activities/types/pareto";
import { apiFetchParetoTrend } from "@/app/features/activities/api/analytics_activities";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type Lookback = 2 | 4 | 8 | 12;
const C = { easy: appColors.chartLine1, hard: appColors.chartLine2 };

/* ─── WEEK POPUP ─── */
function WeekPopup({
  data, rows, onClose, t,
}: { data: any; rows: ParetoRow[]; onClose: () => void; t: any }) {
  const raw = rows.find((r) => r.label === data.label);

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

      {/* Percentá */}
      {[
        { color: C.easy, label: t("pareto8020.trend.labelEasy"), val: `${data.easy_pct ?? 0}%` },
        { color: C.hard, label: t("pareto8020.trend.labelHard"), val: `${data.hard_pct ?? 0}%` },
      ].map(({ color, label, val }) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: appColors.textMuted }}>{label}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
        </div>
      ))}

      {/* Časy */}
      {raw && (raw.easy_min > 0 || raw.hard_min > 0) && (
        <div style={{
          marginTop: 4, paddingTop: 6, borderTop: `1px solid ${appColors.divider}`,
          fontSize: 11, color: appColors.textMuted, opacity: 0.75,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          <span>{t("pareto8020.trend.labelEasy")} {fmtSecondsHMS((raw.easy_min || 0) * 60)}</span>
          <span>{t("pareto8020.trend.labelHard")} {fmtSecondsHMS((raw.hard_min || 0) * 60)}</span>
        </div>
      )}
    </div>
  );
}


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
    const handler = (e: MouseEvent) => {
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
export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: ParetoWeekPick | null) => void;
}) {
  const { userId } = useUserId();
  const [lookback, setLookback]           = useState<Lookback>(2);
  const [loading, setLoading]             = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const t = useT();

  const [selectedSports, setSelectedSports] = useState<string[]>(Array.from(PARETO_DEFAULT_SET));
  const [rows, setRows]                     = useState<ParetoRow[]>([]);
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

  const chartData = useMemo(() =>
    rows.map((r) => ({
      label: r.label,
      easy_pct: Number.isFinite(r.easy_pct) ? r.easy_pct : 0,
      hard_pct: Number.isFinite(r.hard_pct) ? r.hard_pct : 0,
      rawRow: r,
    })),
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
    const r = chartData[index].rawRow;
    if (r?.start && r?.end) onPickWeek?.({ start: r.start, end: r.end, sport: "all" });
  }, [selectedIndex, chartData, onPickWeek]);

  const handleDismiss = useCallback(() => {
    setSelectedIndex(null);
    onPickWeek?.(null);
  }, [onPickWeek]);

  const xAxisInterval = lookback <= 4 ? 0 : lookback <= 8 ? 1 : 2;
  const selectedLabel = selectedIndex !== null ? chartData[selectedIndex]?.label : null;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>

      {/* ── Header ── */}
      <div style={{ padding: "14px 16px 8px 16px" }}>
        {/* Riadok 1: titul + select */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <h2 className={PANEL_TITLE}>{t("pareto8020.trend.title")}</h2>
          <SelectField
            value={String(lookback)}
            onValueChange={(v) => setLookback(Number(v) as Lookback)}
            options={WEEK_OPTIONS(t)}
            placeholder="—"
            containerClassName="w-[110px]"
            variant="editable"
          />
        </div>

        {/* Riadok 2: kompaktný sport picker */}
        <SportPicker
          visibleSportsOptions={visibleSportsOptions}
          selectedSports={selectedSports}
          onToggle={toggleSport}
          t={t}
        />
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
                const isSel = selectedIndex === index;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={14} textAnchor="middle"
                      fill={isSel ? appColors.brandPrimary : appColors.textMuted}
                      fontWeight={isSel ? 700 : 400} fontSize={10}>
                      {payload.value}
                    </text>
                  </g>
                );
              }}
            />

            <YAxis
              width={42}
              domain={[0, 100]}
              tick={{ fill: appColors.textMuted, fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{ value: `[%]`, angle: -90, position: "insideLeft",
                fill: appColors.textMuted, fontSize: 10, dx: 8, dy: 20 }}
            />

            {/* Vypnutý Recharts tooltip — popup je dole */}
            <Tooltip active={false} />

            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

            {/* 80/20 referenčné čiary */}
            <ReferenceLine y={80} stroke={C.easy} strokeDasharray="3 3" strokeOpacity={0.5}
              label={{ position: "top", value: "80%", fill: C.easy, fontSize: 10 }} />
            <ReferenceLine y={20} stroke={C.hard} strokeDasharray="3 3" strokeOpacity={0.5}
              label={{ position: "top", value: "20%", fill: C.hard, fontSize: 10 }} />

            {/* Zvislá čiara pre vybraný týždeň */}
            {selectedLabel && (
              <ReferenceLine x={selectedLabel} stroke={appColors.brandPrimary}
                strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.8} />
            )}

            <Line type="monotone" dataKey="easy_pct"
              name={t("pareto8020.trend.labelEasy") as string}
              stroke={C.easy} strokeWidth={3}
              dot={{ r: 3, fill: C.easy, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              isAnimationActive={false}   // ← rýchle renderovanie
              connectNulls />

            <Line type="monotone" dataKey="hard_pct"
              name={t("pareto8020.trend.labelHard") as string}
              stroke={C.hard} strokeWidth={3} strokeDasharray="5 5"
              dot={{ r: 3, fill: C.hard, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              isAnimationActive={false}   // ← rýchle renderovanie
              connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Popup pod grafom ── */}
      {selectedIndex !== null && chartData[selectedIndex] && (
        <WeekPopup
          data={chartData[selectedIndex]}
          rows={rows}
          t={t}
          onClose={handleDismiss}
        />
      )}
    </div>
  );
}
