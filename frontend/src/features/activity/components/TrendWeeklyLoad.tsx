// src/features/activity/components/TrendWeeklyLoad.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { useOrientation } from "@/shared/hooks/useOrientation";

ensureChartJSRegistered();

type Metric = "km" | "time" | "trimp";

export type WeekPick = { week: string; start: string; end: string };

type WeekRow = {
  week: string; label: string; start: string; end: string;
  km_run: number; km_ride: number; km_mixed: number; km_skate: number; km_total: number;
  time_min: number; time_run_min: number; time_ride_min: number; time_strength_min: number; time_mixed_min: number; time_skate_min: number; time_other_min: number;
  trimp_run: number; trimp_ride: number; trimp_strength: number; trimp_mixed: number; trimp_skate: number; trimp_other: number; trimp: number;
  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};

const DEFAULTS = {
  lookback: 26,
  metric: "km" as const,
  sports: { run: true, bike: true, strength: true, mixed: true, skate: true, other: true },
};

// farby
const C = {
  run: "#22D3EE", bike: "#A78BFA", strength: "#F59E0B", mixed: "#34D399", skate: "#60A5FA", other: "#9CA3AF",
  monotony: "#84CC16", strain: "#FDE047",
};
const a = (hex: string, t: number) =>
  `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${t})`;

const fmtMin = (m: number) => {
  const mm = Math.round(m || 0);
  if (mm < 60) return `${mm} min`;
  const h = Math.floor(mm / 60), r = mm % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const fmtKm = (v: number) => `${(v || 0).toFixed(1)} km`;

// storage kľúč na “last pick”
const LAST_PICK_KEY = "tw_last_pick";

export default function TrendWeeklyLoad({
  onPickWeek,
  autoPickLatest = true,        // ak je true, po načítaní dát automaticky zvolíme posledný týždeň
}: {
  onPickWeek?: (w: WeekPick) => void;
  autoPickLatest?: boolean;
}) {
  const { userId } = useUserId();
  const { isPortrait } = useOrientation();

  // nastavenia
  const [metric, setMetric]       = useLocalStorage<Metric>("tw_metric", DEFAULTS.metric);
  const [lookback, setLookback]   = useLocalStorage<number>("tw_lookback", DEFAULTS.lookback);
  const [sRun, setSRun]           = useLocalStorage<boolean>("tw_run", DEFAULTS.sports.run);
  const [sBike, setSBike]         = useLocalStorage<boolean>("tw_bike", DEFAULTS.sports.bike);
  const [sStrength, setSStrength] = useLocalStorage<boolean>("tw_strength", DEFAULTS.sports.strength);
  const [sMixed, setSMixed]       = useLocalStorage<boolean>("tw_mixed", DEFAULTS.sports.mixed);
  const [sSkate, setSSkate]       = useLocalStorage<boolean>("tw_skate", DEFAULTS.sports.skate);
  const [sOther, setSOther]       = useLocalStorage<boolean>("tw_other", DEFAULTS.sports.other);

  // data & UI
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [picked, setPicked] = useState<WeekPick | null>(null);
  const [showDetail, setShowDetail] = useState(false); // portrait: mini vs detail

  // režimy
  const mode: "mini" | "scroll" | "full" = isPortrait ? (showDetail ? "scroll" : "mini") : "full";
  useEffect(() => { if (mode === "full" && lookback > 8) setLookback(8); /* desktop default 8 */ }, [mode]); // eslint-disable-line

  const effectiveLookback = mode === "mini" ? THEME.mobile.miniWeeks : lookback;

  // fetch
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/analytics/weekly/${userId}?weeks=${effectiveLookback}`;
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        const num = (v: any) => (Number.isFinite(+v) ? +v : 0);
        const norm: WeekRow[] = raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "", end: w.end ?? "",
          km_run: num(w.km_run ?? w.run_km), km_ride: num(w.km_ride ?? w.ride_km ?? w.km_bike),
          km_mixed: num(w.km_mixed), km_skate: num(w.km_skate), km_total: num(w.km_total ?? w.total_km),
          time_min: num(w.time_min ?? w.total_min), time_run_min: num(w.time_run_min ?? w.run_min), time_ride_min: num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_mixed_min: num(w.time_mixed_min), time_skate_min: num(w.time_skate_min), time_other_min: num(w.time_other_min ?? w.other_min),
          trimp_run: num(w.trimp_run ?? w.run_trimp), trimp_ride: num(w.trimp_ride ?? w.bike_trimp), trimp_strength: num(w.trimp_strength ?? w.strength_trimp),
          trimp_mixed: num(w.trimp_mixed), trimp_skate: num(w.trimp_skate), trimp_other: num(w.trimp_other ?? w.other_trimp), trimp: num(w.trimp ?? w.total_trimp),
          monotony: w.monotony ?? {}, strain: w.strain ?? {},
        }));
        setWeeks(norm);
      } catch (e) {
        console.error("[FE] weekly error:", e);
        setWeeks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, effectiveLookback]);

  // --- AUTO PICK & PERSIST ---
  // ak máme uložený last pick a je v aktuálnej sade týždňov, použijeme ho
  useEffect(() => {
    if (!weeks.length) return;

    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(LAST_PICK_KEY) || "null") as WeekPick | null; }
      catch { return null; }
    })();

    let target: WeekPick | null = null;

    if (saved) {
      const hit = weeks.find(w => w.week === saved.week);
      if (hit) target = { week: hit.week, start: hit.start, end: hit.end };
    }
    if (!target && autoPickLatest) {
      const w = weeks[weeks.length - 1];
      target = w ? { week: w.week, start: w.start, end: w.end } : null;
    }

    if (target) {
      setPicked(target);
      onPickWeek?.(target);
      localStorage.setItem(LAST_PICK_KEY, JSON.stringify(target));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  // ----- series -----
  const labelsAll = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);
  const monoSeriesAll = useMemo(() => weeks.map((w) => w.monotony?.[metric] ?? null), [weeks, metric]);
  const strainSeriesAll = useMemo(() => weeks.map((w) => w.strain?.[metric] ?? null), [weeks, metric]);

  const monoMax = monoSeriesAll.filter((v): v is number => v != null).length ? Math.max(1, ...monoSeriesAll.filter((v): v is number => v != null)) : 3;
  const strainMax = strainSeriesAll.filter((v): v is number => v != null).length ? Math.max(1, ...strainSeriesAll.filter((v): v is number => v != null)) : 10;

  const compact = mode === "mini";
  const labels = compact ? labelsAll.slice(-THEME.mobile.miniWeeks) : labelsAll;
  const slicedWeeks = compact ? weeks.slice(-THEME.mobile.miniWeeks) : weeks;
  const monoSeries = compact ? monoSeriesAll.slice(-THEME.mobile.miniWeeks) : monoSeriesAll;
  const strainSeries = compact ? strainSeriesAll.slice(-THEME.mobile.miniWeeks) : strainSeriesAll;

  // dataset shape (pozor: do datasetu, nie do options)
  const BAR_SHAPE = compact
    ? { maxBarThickness: 10, categoryPercentage: 0.5, barPercentage: 0.6 }
    : { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 };

  const datasets = useMemo(() => {
    const ds: any[] = [];
    const W = slicedWeeks;
    const pushBar = (label: string, data: number[], color: string) =>
      ds.push({
        type: "bar" as const,
        label, data,
        backgroundColor: a(color, 0.85),
        borderColor: color,
        borderWidth: 1,
        yAxisID: "y",
        ...BAR_SHAPE,
      });

    if (metric === "km") {
      if (sRun)  pushBar("Km (run)",     W.map(w=>w.km_run),   C.run);
      if (sBike) pushBar("Km (bike)",    W.map(w=>w.km_ride),  C.bike);
      if (sMixed)pushBar("Km (mixed)",   W.map(w=>w.km_mixed), C.mixed);
      if (sSkate)pushBar("Km (skate)",   W.map(w=>w.km_skate), C.skate);
    } else if (metric === "time") {
      if (sRun)     pushBar("Run",     W.map(w=>w.time_run_min),     C.run);
      if (sBike)    pushBar("Bike",    W.map(w=>w.time_ride_min),    C.bike);
      if (sStrength)pushBar("Strength",W.map(w=>w.time_strength_min),C.strength);
      if (sMixed)   pushBar("Mixed",   W.map(w=>w.time_mixed_min),   C.mixed);
      if (sSkate)   pushBar("Skate",   W.map(w=>w.time_skate_min),   C.skate);
      if (sOther)   pushBar("Other",   W.map(w=>w.time_other_min),   C.other);
    } else {
      if (sRun)     pushBar("TRIMP (run)",     W.map(w=>w.trimp_run),     C.run);
      if (sBike)    pushBar("TRIMP (bike)",    W.map(w=>w.trimp_ride),    C.bike);
      if (sStrength)pushBar("TRIMP (strength)",W.map(w=>w.trimp_strength),C.strength);
      if (sMixed)   pushBar("TRIMP (mixed)",   W.map(w=>w.trimp_mixed),   C.mixed);
      if (sSkate)   pushBar("TRIMP (skate)",   W.map(w=>w.trimp_skate),   C.skate);
      if (sOther)   pushBar("TRIMP (other)",   W.map(w=>w.trimp_other),   C.other);
    }

    ds.push({
      type: "line" as const, label: "Monotony", data: monoSeries,
      yAxisID: compact ? "y" : "y1",
      borderColor: C.monotony, backgroundColor: C.monotony,
      tension: 0.3, pointRadius: compact ? 0 : 2, borderWidth: compact ? 2 : 3, spanGaps: true, order: 99,
    });
    ds.push({
      type: "line" as const, label: "Strain", data: strainSeries,
      yAxisID: compact ? "y" : "y2",
      borderColor: C.strain, backgroundColor: C.strain,
      tension: 0.3, pointRadius: compact ? 0 : 2, borderWidth: compact ? 2 : 3, borderDash: compact ? [] : [4, 4],
      spanGaps: true, order: 99,
    });

    return ds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slicedWeeks, metric, sRun, sBike, sStrength, sMixed, sSkate, sOther, monoSeries, strainSeries, compact]);

  const data: ChartData<"bar"|"line", number[], string> = { labels, datasets };

  // options (už bez elements.bar tvarovania!)
  const options: ChartOptions<"bar"|"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: compact ? { display: false } : { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            if (!compact && ctx.dataset.yAxisID === "y1") return `${label}: ${v?.toFixed?.(2) ?? v}`;
            if (!compact && ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;
            if (metric === "km")   return `${label}: ${fmtKm(v)}`;
            if (metric === "time") return `${label}: ${fmtMin(v)}`;
            return `${label}: ${Math.round(v)} TRIMP`;
          },
        },
      },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index;
      if (idx == null) return;
      const w = (compact ? weeks.slice(-THEME.mobile.miniWeeks) : weeks)[idx];
      if (!w) return;
      const pick: WeekPick = { week: w.week, start: w.start, end: w.end };
      setPicked(pick);
      localStorage.setItem(LAST_PICK_KEY, JSON.stringify(pick));
      onPickWeek?.(pick);
    },
    scales: {
      y:  { beginAtZero: true, title: { display: true, text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP" }, grid: { color: THEME.chart.grid } },
      y1: compact ? { display: false } : { position: "right", min: 0, max: Math.max(3, Math.ceil(monoMax + 0.5)), grid: { drawOnChartArea: false }, title: { display: true, text: "Monotony" } },
      y2: compact ? { display: false } : { position: "right", min: 0, max: Math.ceil(strainMax * 1.1), grid: { drawOnChartArea: false }, title: { display: true, text: "Strain" } },
      x:  { grid: { color: THEME.chart.gridSoft } },
    },
  };

  const helpText =
    metric === "km"   ? "Rozdelenosť vzdialenosti podľa športu."
  : metric === "time" ? "Odtrénovaný čas podľa športu."
                      : "TRIMP – intenzita × trvanie. Monotony ≈ konzistentnosť; Strain = TRIMP × Monotony.";

  const perWeekPx = 24;
  const scrollMinWidth = Math.max(THEME.layout.tableMinWidth, perWeekPx * labels.length + 120);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative">
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Weekly Load</h3>

        <div className="flex items-center gap-3">
          {/* metrika */}
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-70">Zobraziť:</span>
            <button onClick={() => setMetric("km")}   className={`px-2 py-1 rounded ${metric === "km"   ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Km</button>
            <button onClick={() => setMetric("time")} className={`px-2 py-1 rounded ${metric === "time" ? "bg-blue-600 text-white" : "bg-gray-700"}`}>Čas</button>
            <button onClick={() => setMetric("trimp")}className={`px-2 py-1 rounded ${metric === "trimp"? "bg-blue-600 text-white" : "bg-gray-700"}`}>TRIMP</button>
          </div>

          {/* rozsah */}
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-70">Rozsah:</span>
            {mode === "mini" ? (
              <span className="px-2 py-1 rounded bg-gray-700">{THEME.mobile.miniWeeks} týždne</span>
            ) : (
              <select value={lookback} onChange={(e) => setLookback(Number(e.target.value))} className="px-2 py-1 rounded bg-gray-700" title="Počet týždňov v grafe">
                <option value={8}>8 týždňov</option>
                <option value={12}>12 týždňov</option>
                <option value={26}>26 týždňov</option>
                <option value={52}>52 týždňov</option>
              </select>
            )}
          </div>

          {/* filtre športov – na mobile skryté */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1"><input type="checkbox" checked={sRun}      onChange={(e)=>setSRun(e.target.checked)} /> Run</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sBike}     onChange={(e)=>setSBike(e.target.checked)} /> Bike</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sStrength} onChange={(e)=>setSStrength(e.target.checked)} /> Strength</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sMixed}    onChange={(e)=>setSMixed(e.target.checked)} /> Mixed</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sSkate}    onChange={(e)=>setSSkate(e.target.checked)} /> Skate</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={sOther}    onChange={(e)=>setSOther(e.target.checked)} /> Other</label>
          </div>

          {/* help */}
          <div className="relative">
            <button className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs" onClick={() => setShowHelp(v=>!v)} title="Čo je zobrazené?">i</button>
            {showHelp && (
              <div className="absolute right-0 mt-2 w-80 text-sm bg-gray-900 text-gray-100 border border-gray-700 rounded shadow-xl p-3 z-10">
                <div className="font-semibold mb-1">Nápoveda</div>
                <p className="mb-2">{helpText}</p>
              </div>
            )}
          </div>

          {/* portrait toggle */}
          {isPortrait && (
            <button onClick={() => setShowDetail(v=>!v)} className="text-xs px-2 py-1 rounded bg-gray-700">
              {showDetail ? "Menej detailov" : "Detailný graf"}
            </button>
          )}
        </div>
      </div>

      {/* graf */}
      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <>
          {mode === "mini" && (
            <div style={{ height: THEME.chart.weeklyHeightCompact }}>
              <MixedChart type="bar" data={data} options={options} />
              <div className="mt-2 text-xs opacity-70">{THEME.copy.rotateHint}</div>
            </div>
          )}
          {mode === "scroll" && (
            <div className="overflow-x-auto">
              <div style={{ minWidth: scrollMinWidth, height: THEME.chart.weeklyHeight }}>
                <MixedChart type="bar" data={data} options={options} />
              </div>
            </div>
          )}
          {mode === "full" && (
            <div style={{ height: THEME.chart.weeklyHeight }}>
              <MixedChart type="bar" data={data} options={options} />
            </div>
          )}
        </>
      )}

      {picked && (
        <WeeklySummary weeks={weeks as any} metric={metric} selectedWeek={picked.week} />
      )}
    </div>
  );
}
