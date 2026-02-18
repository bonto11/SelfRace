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
  ReferenceLine,
} from "recharts";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import { fmtSecondsHMS } from "@/app/shared/utils/time";

import {
  SPORT_OPTIONS,
  PARETO_DEFAULT_SET,
  normalizeSport,
  sportsToCSV,
  isInParetoDefault,
} from "@/app/configs/config_sports";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";

import {
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
  PANEL_INNER_STACK,
} from "@/app/shared/ui/tokens";

import type {
  ParetoWeekPick,
  ParetoRow,
} from "@/app/features/activities/types/pareto";
import { apiFetchParetoTrend } from "@/app/features/activities/api/analytics_activities";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type Lookback = 2 | 4 | 8 | 12;

// Prémiový Recharts Tooltip
const ParetoTooltip = ({ active, payload, label, t, rows }: any) => {
  if (active && payload && payload.length) {
    const r = rows.find((row: any) => row.label === label);

    return (
      <div 
        className="p-3 rounded-xl border shadow-xl backdrop-blur-md focus:outline-none outline-none"
        style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
      >
        <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>{label}</p>
        
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            <span className="opacity-90">{entry.name}:</span>
            <span className="font-bold">{Number(entry.value).toFixed(1)}%</span>
          </div>
        ))}

        {r && (
          <div className="mt-3 pt-2 border-t text-[10px] opacity-70" style={{ borderColor: appColors.divider }}>
            {t("pareto8020.trend.labelEasy")} {fmtSecondsHMS(r.easy_min || 0)} <br/>
            {t("pareto8020.trend.labelHard")} {fmtSecondsHMS(r.hard_min || 0)}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: ParetoWeekPick) => void;
}) {
  const { userId } = useUserId();
  const [lookback, setLookback] = useState<Lookback>(2);
  const [loading, setLoading] = useState(false);
  const t = useT();

  const [selectedSports, setSelectedSports] = useState<string[]>(
    Array.from(PARETO_DEFAULT_SET),
  );

  const sportCsv = useMemo(() => {
    const csv = sportsToCSV(selectedSports);
    return !csv || csv === "all" ? null : csv;
  }, [selectedSports]);

  const [rows, setRows] = useState<ParetoRow[]>([]);
  const [fetchedAvailableSports, setFetchedAvailableSports] = useState<string[]>([]);
  
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const response = await apiFetchParetoTrend(userId, lookback, sportCsv);
        if (!alive) return;
        
        setRows(response.trend as ParetoRow[]);
        
        if (response.availableSports && response.availableSports.length > 0) {
          setFetchedAvailableSports(response.availableSports);
        }
        
        setPickedIdx(null);
      } catch (e: any) {
        console.error("Pareto trend fetch failed:", t(e?.message as any));
        if (!alive) return;
        setRows([]);
        setPickedIdx(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId, lookback, sportCsv, t]);

  const visibleSportsOptions = useMemo(() => {
    if (fetchedAvailableSports.length === 0) return SPORT_OPTIONS;
    return SPORT_OPTIONS.filter((opt) => {
      const norm = normalizeSport(opt.value);
      return norm && fetchedAvailableSports.includes(norm);
    });
  }, [fetchedAvailableSports]);

  const chartData = useMemo(() => {
    return rows.map((r, i) => ({
      label: r.label,
      easy_pct: Number.isFinite(r.easy_pct) ? r.easy_pct : 0,
      hard_pct: Number.isFinite(r.hard_pct) ? r.hard_pct : 0,
      rawRow: r,
    }));
  }, [rows]);

  const toggleSport = (s: string) => {
    const n = normalizeSport(s);
    if (!n || n === "all") return;
    setPickedIdx(null);
    setSelectedSports((prev) => {
      const set = new Set(prev.map(normalizeSport).filter(Boolean) as string[]);
      set.has(n) ? set.delete(n) : set.add(n);
      return Array.from(set);
    });
  };

  useEffect(() => {
    if (selectedSports.length === 0) {
      setSelectedSports(Array.from(PARETO_DEFAULT_SET));
    }
  }, [selectedSports.length]);

  const handleChartClick = (state: any) => {
    if (!onPickWeek || !state) return;
    
    // ✅ Použijeme index z Tooltipu (identické riešenie ako pre WeeklyLoad)
    const index = state.activeTooltipIndex ?? state.activeIndex;
    
    if (index !== undefined && chartData[index]) {
      const r = chartData[index].rawRow;
      
      if (r && r.start && r.end) {
        setPickedIdx(index);
        onPickWeek({
          start: r.start,
          end: r.end,
          sport: "all",
        });
      }
    }
  };

  const pickedLabel = pickedIdx !== null && chartData[pickedIdx] ? chartData[pickedIdx].label : null;

  return (
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        
        <div className={[PANEL_CARD_HEAD, "flex-wrap gap-4"].join(" ")}>
          <h2 className={PANEL_TITLE}>{t("pareto8020.trend.title")}</h2>
          <div className="ml-auto">
            <SelectField
              value={String(lookback)}
              onValueChange={(value: string) => setLookback(Number(value) as Lookback)}
              options={WEEK_OPTIONS(t)}
              placeholder="—"
              containerClassName="w-[120px]"
              variant="editable"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleSportsOptions.map((opt) => {
            const norm = normalizeSport(opt.value) ?? "";
            const active = selectedSports.map(normalizeSport).includes(norm);
            const isDefault = isInParetoDefault(norm);

            return (
              <Button
                key={opt.value}
                size="xs"
                variant={active ? "active" : "editable"}
                onClick={() => toggleSport(opt.value)}
                title={isDefault ? t("pareto8020.trend.inRange") : t("pareto8020.trend.outRange")}
              >
                {opt.label}
                {isDefault ? "" : " *"}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ✅ Reset outline v CSS */}
      <div className="w-full relative px-2 sm:px-4 pb-4 focus:outline-none [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none select-none" style={{ height: 360 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/20 rounded-b-xl backdrop-blur-sm">
            <LoadingSpinner size="trend" />
          </div>
        )}
        
        {/* ✅ minWidth a minHeight proti errorom */}
         <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <LineChart data={chartData} onClick={handleChartClick} margin={{ top: 20, right: 10, left: 10, bottom: 0 }} style={{ outline: 'none' }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
            
            {pickedLabel && (
              <ReferenceLine 
                x={pickedLabel} 
                stroke={appColors.textMuted} 
                strokeOpacity={0.3} 
                strokeWidth={20} 
              />
            )}

            <XAxis 
              dataKey="label" 
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false} 
              dy={10}
            />
            
            <YAxis 
              domain={[0, 100]}
              tick={{ fill: appColors.textMuted, fontSize: 10 }} 
              axisLine={false} 
              tickLine={false}
              tickFormatter={(val) => `${val}${t("common.units.pct")}`}
              label={{ value: `[${t("common.units.pct")}]`, angle: -90, position: 'insideLeft', fill: appColors.textMuted, fontSize: 10, dy: 30 }}
            />
            
            {/* ✅ Zabitie pozadia na Tooltipe */}
            <Tooltip content={<ParetoTooltip t={t} rows={rows} />} cursor={{ fill: "transparent", stroke: "transparent" }} wrapperStyle={{ outline: 'none' }} />
            
            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            
            <ReferenceLine y={80} stroke={appColors.chartLine1} strokeDasharray="3 3" opacity={0.5} label={{ position: 'top', value: '80%', fill: appColors.chartLine1, fontSize: 10 }} />
            <ReferenceLine y={20} stroke={appColors.chartLine2} strokeDasharray="3 3" opacity={0.5} label={{ position: 'top', value: '20%', fill: appColors.chartLine2, fontSize: 10 }} />

            <Line 
              type="monotone" 
              dataKey="easy_pct" 
              name={t("pareto8020.trend.labelEasy") as string} 
              stroke={appColors.chartLine1} 
              strokeWidth={3}
              /* ✅ Vymazané outline: none z dot a presunuté na Line style */
              dot={{ r: 3, fill: appColors.chartLine1, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: 'none' }}
              connectNulls
            />
            
            <Line 
              type="monotone" 
              dataKey="hard_pct" 
              name={t("pareto8020.trend.labelHard") as string} 
              stroke={appColors.chartLine2} 
              strokeWidth={3}
              strokeDasharray="5 5"
              /* ✅ Rovnako tu */
              dot={{ r: 3, fill: appColors.chartLine2, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              style={{ outline: 'none' }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}