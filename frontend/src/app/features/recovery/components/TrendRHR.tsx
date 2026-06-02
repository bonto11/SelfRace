"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush,
} from "recharts";

import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import { rollingMean, bandsAround, wrapToLines } from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD, SURFACE_CARD_STYLE,
  PANEL_SECTION_TITLE, PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { EventsIcon, TooltipEvents, EventsLegend } from "@/app/shared/charts/RecoveryEvents";

/* ─── HELPERS ─── */
function getLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO   + "T00:00:00");
  while (cur <= end) { out.push(getLocalISODate(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}

/* ─── TOOLTIP ─── */
const RecoveryTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  const mainData    = payload.find((p: any) => p.dataKey === "val");
  const missingData = payload.find((p: any) => p.dataKey === "missingY");
  const comments    = payload[0]?.payload?.comments;
  return (
    <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md max-w-xs"
      style={{ backgroundColor: "rgba(9,24,18,0.95)", borderColor: appColors.panelBorder }}>
      <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>
        {new Date(label).toLocaleDateString("sk-SK")}
      </p>
      {mainData?.value != null ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: mainData.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mainData.color }} />
          <span className="opacity-90">RHR:</span>
          <span className="font-bold">{Math.round(mainData.value)} {t("common.units.hr")}</span>
        </div>
      ) : missingData ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="opacity-90">{t("recovery.trends.rhr.noRecord")}</span>
        </div>
      ) : null}
      <TooltipEvents payload={payload[0]?.payload} t={t} />
      {comments && (
        <div className="mt-2 pt-2 border-t text-[11px] opacity-70 italic whitespace-pre-wrap"
          style={{ borderColor: appColors.divider }}>
          {wrapToLines(comments, 44).join("\n")}
        </div>
      )}
    </div>
  );
};

/* ─── EXPAND ICON ─── */
const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 1h4M1 1v4M15 1h-4M15 1v4M1 15h4M1 15v-4M15 15h-4M15 15v-4"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ─── SPOLOČNÉ CHART SERIES (DRY) ─── */
interface SeriesProps {
  COLOR: { main: string; bandFill: string; missing: string };
  t: any;
  yMin: number; yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  chartData: any[];
}

function ChartSeries({ COLOR, t, yMin, yMax, tickInterval, yAxisLabel, chartData }: SeriesProps) {
  const fmt = (v: any) => new Date(v).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" });
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />
      <XAxis dataKey="date" interval={tickInterval}
        tick={{ fill: appColors.textMuted, fontSize: 10 }}
        axisLine={false} tickLine={false} dy={8} tickFormatter={fmt} />
      <YAxis domain={[yMin, yMax]}
        tick={{ fill: appColors.textMuted, fontSize: 10 }}
        axisLine={false} tickLine={false}
        label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: appColors.textMuted, fontSize: 10, dy: 30 }} />
      <Tooltip content={<RecoveryTooltip t={t} />}
        cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
      <Area type="monotone" dataKey="bandRange" stroke="none"
        fill={COLOR.bandFill} fillOpacity={1} legendType="none" connectNulls />
      <Line type="monotone" dataKey="val"
        name={t("recovery.trends.rhr.rhrLabel") as string}
        stroke={COLOR.main} strokeWidth={3}
        dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
        activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
      <Scatter dataKey="missingY"
        name={t("recovery.trends.rhr.missingLabel") as string}
        fill={COLOR.missing} r={4} />
      <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />
      <Brush dataKey="date" height={26} travellerWidth={10}
        stroke={appColors.panelBorder} fill="#0a1f14" tickFormatter={fmt} />
    </>
  );
}

/* ─── LANDSCAPE OVERLAY ─── */
interface LandscapeOverlayProps {
  onClose: () => void;
  chartData: any[];
  yMin: number; yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  COLOR: { main: string; bandFill: string; missing: string };
  t: any;
  weeks: number;
  onWeeksChange: (v: number) => void;
}

function LandscapeOverlay({ onClose, chartData, yMin, yMax, tickInterval, yAxisLabel, COLOR, t, weeks, onWeeksChange }: LandscapeOverlayProps) {
  // Explicitné rozmery z okna — ResponsiveContainer nefunguje správne v rotovanom div
  // Po rotate(90deg): vizuálna šírka = výška telefónu (innerHeight), vizuálna výška = šírka (innerWidth)
  const [chartW, setChartW] = useState(0);
  const [chartH, setChartH] = useState(0);
  const HEADER_H = 48;
  const PAD_H    = 24; // padding top+bottom

  useEffect(() => {
    const calc = () => {
      // Portrait viewport: vw = šírka, vh = výška
      // V landscape (po otočení): vizuálna šírka = vh, vizuálna výška = vw
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setChartW(vh - 32);         // landscape vizuálna šírka mínus side padding
      setChartH(vw - HEADER_H - PAD_H); // landscape vizuálna výška mínus header
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  useEffect(() => {
    // Pokus o lock — funguje Android PWA, iOS ignoruje
    (screen.orientation as any)?.lock?.("landscape-primary").catch?.(() => {});
    return () => { (screen.orientation as any)?.unlock?.(); };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!chartW || !chartH) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#071610",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoadingSpinner size="trend" />
    </div>
  );

  return (
    // Klik na pozadie = zatvoriť
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#071610", overflow: "hidden" }}>

      {/*
        CSS transform trik pre iOS kde orientation.lock nefunguje.
        Matematika:
        - width: 100vh, height: 100vw (pred rotáciou)
        - left: calc((vw - vh) / 2) = centruje po rotácii
        - top: calc((vh - vw) / 2)
        - rotate(90deg) → vizuálne landscape
      */}
      <div
        onClick={(e) => e.stopPropagation()} // klik vnútri nezatvára
        style={{
          position: "absolute",
          left: "calc((100vw - 100vh) / 2)",
          top: "calc((100vh - 100vw) / 2)",
          width: "100vh",
          height: "100vw",
          transform: "rotate(90deg)",
          transformOrigin: "center center",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px",
          boxSizing: "border-box",
        }}
      >
        {/* Zatvoriť */}
        <button onClick={onClose}
          style={{
            position: "absolute", top: 10, right: 12,
            width: 32, height: 32, borderRadius: "50%",
            border: `1px solid ${appColors.panelBorder}`,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: appColors.textPrimary,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 1, outline: "none", fontSize: 14,
          }}>
          ✕
        </button>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", height: HEADER_H,
          marginBottom: 4, paddingRight: 44, flexShrink: 0,
        }}>
          <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary, fontSize: 14 }}>
            {t("recovery.trends.rhr.title")}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <SelectField
              value={String(weeks)}
              onChange={(e) => onWeeksChange(Number(e.target.value))}
              options={WEEK_OPTIONS(t)}
              variant="editable"
              containerClassName="w-[110px]"
            />
          </div>
        </div>

        {/*
          Kľúčová oprava: NEpoužívame ResponsiveContainer — v rotovanom div
          nefunguje správne (detekuje zlé rozmery).
          Namiesto toho dáme ComposedChart explicitné pixel rozmery.
        */}
        <ComposedChart width={chartW} height={chartH} data={chartData}
          margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <ChartSeries
            COLOR={COLOR} t={t}
            yMin={yMin} yMax={yMax}
            tickInterval={tickInterval} yAxisLabel={yAxisLabel}
            chartData={chartData}
          />
        </ComposedChart>
      </div>
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function TrendRHR() {
  const t = useT();
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showLandscape, setShowLandscape] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const COLOR = { main: appColors.chartLine1, bandFill: appColors.chartBandFill, missing: appColors.stateBad };

  useEffect(() => {
    setLoading(true);
    const f = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(f);
  }, [weeks, all]);

  const endISO   = useMemo(() => isMounted ? getLocalISODate(new Date()) : getLocalISODate(new Date()), [isMounted]);
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setDate(d.getDate() - (weeks * 7 - 1));
    return getLocalISODate(d);
  }, [endISO, weeks]);

  const byDate = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const r of all) m.set(r.date, r);
    return m;
  }, [all]);

  const labelsISO = useMemo(() => dateSeq(startISO, endISO), [startISO, endISO]);

  const rhr = useMemo(() =>
    labelsISO.map((d) => { const r = byDate.get(d); return typeof r?.RHR_bpm === "number" ? r.RHR_bpm : NaN; }),
    [labelsISO, byDate],
  );

  const baselineArr = useMemo(() => rollingMean(rhr.map((v) => Number.isFinite(v) ? (v as number) : null), 14), [rhr]);
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const missingY = useMemo(() => {
    const n = rhr.length;
    const out = new Array<number | null>(n).fill(null);
    const nxt = new Array<number>(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) { if (Number.isFinite(rhr[i])) last = i; nxt[i] = last; }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(rhr[i])) { prev = i; continue; }
      const nx = nxt[i];
      if (prev !== -1 && nx !== -1) out[i] = (rhr[prev] as number) + ((rhr[nx] as number) - (rhr[prev] as number)) * ((i - prev) / (nx - prev));
      else if (prev !== -1) out[i] = rhr[prev] as number;
      else if (nx !== -1)  out[i] = rhr[nx] as number;
    }
    return out;
  }, [rhr]);

  const chartData = useMemo(() => labelsISO.map((d, i) => {
    const v = rhr[i];
    const miss = !Number.isFinite(v);
    const rec = byDate.get(d);
    const hasAlcohol = !!rec?.alcohol_consumed;
    const hasFood    = !!rec?.food_2h_before;
    const hasCaff    = !!rec?.caffeine_8h;
    return {
      date: d,
      val: miss ? null : v,
      bandRange: lower[i] != null && upper[i] != null ? [lower[i], upper[i]] : null,
      missingY: miss ? missingY[i] : null,
      comments: rec?.comments,
      hasAlcohol, hasFood, hasCaffeine: hasCaff,
      eventsY: (hasAlcohol || hasFood || hasCaff) ? (miss ? missingY[i] : v) : null,
    };
  }), [labelsISO, rhr, lower, upper, missingY, byDate]);

  if (!isMounted) return null;

  const allValid = [...rhr.filter(Number.isFinite), ...lower.filter((v): v is number => v !== null), ...upper.filter((v): v is number => v !== null)];
  const yMin = allValid.length ? Math.max(30, Math.floor((Math.min(...allValid) - 10) / 5) * 5) : 40;
  const yMax = allValid.length ? Math.ceil((Math.max(...allValid) + 5) / 5) * 5 : 80;
  const yAxisLabel   = `[${t("common.units.hr")}]`;
  const tickInterval = weeks <= 2 ? 2 : weeks <= 4 ? 3 : weeks <= 8 ? 6 : 13;

  const seriesProps = { COLOR, t, yMin, yMax, tickInterval, yAxisLabel, chartData };

  return (
    <>
      {showLandscape && (
        <LandscapeOverlay
          onClose={() => setShowLandscape(false)}
          weeks={weeks}
          onWeeksChange={setWeeks}
          {...seriesProps}
        />
      )}

      <section className={CARD + " relative pb-2"} style={SURFACE_CARD_STYLE}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px 10px 16px", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
              {t("recovery.trends.rhr.title")}
            </div>
            <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>
              {t("recovery.trends.rhr.subtitle")}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowLandscape(true)}
              title="Zobraziť na celú obrazovku"
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: `1px solid ${appColors.panelBorder}`,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: appColors.textMuted,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, outline: "none",
              }}>
              <ExpandIcon />
            </button>

            <SelectField
              value={String(weeks)}
              onChange={(e) => setWeeks(Number(e.target.value))}
              options={WEEK_OPTIONS(t)}
              variant="editable"
              containerClassName="w-[110px]"
            />
          </div>
        </div>

        {/* Graf — normálny portrait, ResponsiveContainer tu funguje OK */}
        <div style={{ padding: "0 12px 8px 12px" }}>
          {/* FIX modrý rámček: outline:none + tap-highlight:transparent */}
          <div style={{ width: "100%", height: 340, position: "relative", outline: "none", WebkitTapHighlightColor: "transparent" }}
            tabIndex={-1}>
            {loading && (
              <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
                <LoadingSpinner size="trend" />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <ChartSeries {...seriesProps} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <EventsLegend t={t} />
      </section>
    </>
  );
}
