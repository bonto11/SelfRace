"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer, ComposedChart, Line, Area, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush,
} from "recharts";

import { WEEK_OPTIONS } from "@/app/shared/charts/chart_builders";
import { rollingMean, bandsAround, wrapToLines } from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
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
function calcYDomain(allValid: number[]): [number, number] {
  if (!allValid.length) return [0, 100];
  const mn = Math.min(...allValid);
  const mx = Math.max(...allValid);
  return [Math.max(0, Math.floor(mn) - 5), Math.ceil(mx) + 5];
}

/* ─── TOOLTIP ─── */
const HRVTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  const mainData    = payload.find((p: any) => p.dataKey === "val");
  const maxData     = payload.find((p: any) => p.dataKey === "maxVal");
  const missingData = payload.find((p: any) => p.dataKey === "missingY");
  const comments    = payload[0]?.payload?.comments;
  return (
    <div className="p-3 rounded-xl border shadow-xl backdrop-blur-md max-w-xs"
      style={{ backgroundColor: "rgba(9,24,18,0.92)", borderColor: appColors.panelBorder }}>
      <p className="mb-2 text-xs font-semibold" style={{ color: appColors.textMuted }}>
        {new Date(label).toLocaleDateString("sk-SK")}
      </p>
      {mainData?.value != null ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: mainData.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: mainData.color }} />
          <span className="opacity-90">HRV (Avg):</span>
          <span className="font-bold">{Math.round(mainData.value)} {t("common.units.ms")}</span>
        </div>
      ) : missingData ? (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="opacity-90">{t("recovery.trends.hrv.noRecord")}</span>
        </div>
      ) : null}
      {maxData?.value != null && (
        <div className="flex items-center gap-2 text-sm mt-1" style={{ color: maxData.color }}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: maxData.color }} />
          <span className="opacity-90">HRV (Max):</span>
          <span className="font-bold">{Math.round(maxData.value)} {t("common.units.ms")}</span>
        </div>
      )}
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

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 1h4M1 1v4M15 1h-4M15 1v4M1 15h4M1 15v-4M15 15h-4M15 15v-4"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ─── CHART SERIES ─── */
interface ChartInnerProps {
  chartData: any[];
  yMin: number; yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  COLOR: { main: string; maxLine: string; bandFill: string; missing: string };
  t: any;
  showAdvanced: boolean;
  showLegend?: boolean;
}

function ChartInner({ chartData, yMin, yMax, tickInterval, yAxisLabel, COLOR, t, showAdvanced, showLegend = true }: ChartInnerProps) {
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
      <Tooltip content={<HRVTooltip t={t} />}
        cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
      {showLegend && <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />}
      <Area type="monotone" dataKey="bandRange" stroke="none"
        fill={COLOR.bandFill} fillOpacity={1} legendType="none" connectNulls />
      <Line type="monotone" dataKey="val"
        name={t("recovery.trends.hrv.hrvLabel") as string}
        stroke={COLOR.main} strokeWidth={3}
        dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
        activeDot={{ r: 6, strokeWidth: 0 }} connectNulls />
      {showAdvanced && (
        <Line type="monotone" dataKey="maxVal"
          name={t("recovery.trends.hrv.hrvMaxLabel") as string}
          stroke={COLOR.maxLine} strokeWidth={2} strokeDasharray="4 4"
          dot={{ r: 2, fill: COLOR.maxLine, strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }} connectNulls />
      )}
      <Scatter dataKey="missingY"
        name={t("recovery.trends.hrv.missingLabel") as string}
        fill={COLOR.missing} r={4} />
      <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />
      <Brush dataKey="date" height={26} travellerWidth={10}
        stroke={appColors.panelBorder} fill="#0a1f14" tickFormatter={fmt} />
    </>
  );
}

/* ─── FULLSCREEN OVERLAY ─── */
interface FullscreenOverlayProps extends ChartInnerProps {
  onClose: () => void;
  weeks: number;
  onWeeksChange: (v: number) => void;
  loading: boolean;
}

function FullscreenOverlay(props: FullscreenOverlayProps) {
  const { onClose, chartData, yMin, yMax, tickInterval, yAxisLabel,
    COLOR, t, showAdvanced, weeks, onWeeksChange, loading } = props;

  // onClose sa drží v ref, aby zmena jeho referencie (inline arrow fn v rodičovi)
  // NEVYVOLALA znova celý efekt nižšie — ten sa má spustiť LEN raz pri mount/unmount
  // tohto overlay. Predtým bol onClose v deps poľa, čo pri každom re-renderi rodiča
  // (kým bol overlay otvorený) zbytočne cleanup-lo a znova nastavovalo display na nav,
  // a pri nešťastnom timingu (napr. route change medzi cleanup a re-run) mohol
  // display:none zostať zaseknutý na navigácii.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const nav = document.getElementById("mobile-bottom-nav");
    if (nav) nav.style.setProperty("display", "none", "important");

    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);

    return () => {
      if (nav) nav.style.removeProperty("display");
      window.removeEventListener("keydown", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // spustiť LEN raz pri mount, cleanup LEN raz pri unmount

  const overlay = (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 99999, backgroundColor: "#071610", display: "flex", flexDirection: "column" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          padding: "16px 16px 0 16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          minHeight: 0, boxSizing: "border-box",
        }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10, flexShrink: 0, gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
              {t("recovery.trends.hrv.title")}
            </div>
          </div>
          <SelectField value={String(weeks)} onChange={(e) => onWeeksChange(Number(e.target.value))}
            options={WEEK_OPTIONS(t)} variant="editable" containerClassName="w-[110px]" />
          <button onClick={onClose}
            style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${appColors.panelBorder}`,
              backgroundColor: "rgba(255,255,255,0.08)", color: appColors.textPrimary, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, outline: "none" }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, position: "relative", outline: "none", WebkitTapHighlightColor: "transparent" }} tabIndex={-1}>
          {loading && <div className="absolute inset-0 grid place-items-center z-10 bg-black/10"><LoadingSpinner size="trend" /></div>}
          <ResponsiveContainer width="100%" height="100%" minWidth={1}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <ChartInner chartData={chartData} yMin={yMin} yMax={yMax} tickInterval={tickInterval}
                yAxisLabel={yAxisLabel} COLOR={COLOR} t={t} showAdvanced={showAdvanced} showLegend={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "6px 20px", marginBottom: 6 }}>
            {[
              { color: COLOR.main, label: t("recovery.trends.hrv.hrvLabel") },
              ...(showAdvanced ? [{ color: COLOR.maxLine, label: t("recovery.trends.hrv.hrvMaxLabel") }] : []),
              { color: COLOR.missing, label: t("recovery.trends.hrv.missingLabel") },
            ].map(({ color, label }) => (
              <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: appColors.textMuted }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <EventsLegend t={t} />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : null;
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function TrendHRV() {
  const t = useT();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  // Defenzívna poistka: ak by z akéhokoľvek dôvodu (napr. route change počas
  // otvoreného fullscreenu na inej stránke) ostal na navigácii zaseknutý
  // "display: none !important" z predošlej session, pri mounte tejto komponenty
  // (t.j. pri návšteve stránky s trendmi) ho vynulujeme. Nemení to žiadnu
  // existujúcu funkcionalitu — len istí, že bottom nav je vždy viditeľná,
  // pokiaľ nie je aktívne otvorený fullscreen overlay na TEJTO komponente.
  useEffect(() => {
    if (!showFullscreen) {
      const nav = document.getElementById("mobile-bottom-nav");
      if (nav && nav.style.display === "none") {
        nav.style.removeProperty("display");
      }
    }
  }, [showFullscreen]);

  const COLOR = { main: appColors.chartLine1, maxLine: appColors.chartLine2, bandFill: appColors.chartBandFill, missing: appColors.stateBad };

  useEffect(() => {
    setLoading(true);
    const f = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(f);
  }, [weeks, all]);

  const endISO = useMemo(() => isMounted ? getLocalISODate(new Date()) : getLocalISODate(new Date()), [isMounted]);
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

  const hrv = useMemo(() =>
    labelsISO.map((d) => { const r = byDate.get(d); return typeof r?.HRV_avg_ms === "number" ? r.HRV_avg_ms : NaN; }),
    [labelsISO, byDate]);

  const hrvMax = useMemo(() =>
    labelsISO.map((d) => { const r = byDate.get(d); return typeof r?.HRV_max_ms === "number" ? r.HRV_max_ms : NaN; }),
    [labelsISO, byDate]);

  const baselineArr = useMemo(() => rollingMean(hrv.map((v) => Number.isFinite(v) ? (v as number) : null), 14), [hrv]);
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const missingY = useMemo(() => {
    const n = hrv.length;
    const out = new Array<number | null>(n).fill(null);
    const nxt = new Array<number>(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) { if (Number.isFinite(hrv[i])) last = i; nxt[i] = last; }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(hrv[i])) { prev = i; continue; }
      const nx = nxt[i];
      if (prev !== -1 && nx !== -1)
        out[i] = (hrv[prev] as number) + ((hrv[nx] as number) - (hrv[prev] as number)) * ((i - prev) / (nx - prev));
      else if (prev !== -1) out[i] = hrv[prev] as number;
      else if (nx  !== -1)  out[i] = hrv[nx]  as number;
    }
    return out;
  }, [hrv]);

  const chartData = useMemo(() => labelsISO.map((d, i) => {
    const v = hrv[i];
    const maxV = hrvMax[i];
    const miss = !Number.isFinite(v);
    const rec = byDate.get(d);
    const hasAlcohol = !!rec?.alcohol_consumed;
    const hasFood    = !!rec?.food_2h_before;
    const hasCaff    = !!rec?.caffeine_8h;
    return {
      date: d,
      val: miss ? null : v,
      maxVal: !Number.isFinite(maxV) ? null : maxV,
      bandRange: lower[i] != null && upper[i] != null ? [lower[i], upper[i]] : null,
      missingY: miss ? missingY[i] : null,
      comments: rec?.comments,
      hasAlcohol, hasFood, hasCaffeine: hasCaff,
      eventsY: (hasAlcohol || hasFood || hasCaff) ? (miss ? missingY[i] : v) : null,
    };
  }), [labelsISO, hrv, hrvMax, lower, upper, missingY, byDate]);

  if (!isMounted) return null;

  const allValid = [
    ...hrv.filter(Number.isFinite),
    ...(showAdvanced ? hrvMax.filter(Number.isFinite) : []),
    ...lower.filter((v): v is number => v !== null),
    ...upper.filter((v): v is number => v !== null),
  ];
  const [yMin, yMax] = calcYDomain(allValid);
  const yAxisLabel   = `[${t("common.units.ms")}]`;
  const tickInterval = weeks <= 2 ? 2 : weeks <= 4 ? 3 : weeks <= 8 ? 6 : 13;
  const innerProps: ChartInnerProps = { chartData, yMin, yMax, tickInterval, yAxisLabel, COLOR, t, showAdvanced };

  return (
    <>
      {showFullscreen && (
        <FullscreenOverlay {...innerProps} loading={loading} weeks={weeks}
          onWeeksChange={setWeeks} onClose={() => setShowFullscreen(false)} />
      )}

      <section className={CARD + " relative pb-2"} style={SURFACE_CARD_STYLE}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px 10px 16px", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>{t("recovery.trends.hrv.title")}</div>
            <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>{t("recovery.trends.hrv.subtitle")}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setShowFullscreen(true)}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${appColors.panelBorder}`,
                backgroundColor: "rgba(255,255,255,0.05)", color: appColors.textMuted,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, outline: "none" }}>
              <ExpandIcon />
            </button>
            <SelectField value={String(weeks)} onChange={(e) => setWeeks(Number(e.target.value))}
              options={WEEK_OPTIONS(t)} variant="editable" containerClassName="w-[110px]" />
          </div>
        </div>

        <div style={{ padding: "0 12px 8px 12px" }}>
          <div style={{ width: "100%", height: 340, position: "relative", outline: "none", WebkitTapHighlightColor: "transparent" }} tabIndex={-1}>
            {loading && <div className="absolute inset-0 grid place-items-center z-10 bg-black/10"><LoadingSpinner size="trend" /></div>}
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                <ChartInner {...innerProps} showLegend />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <EventsLegend t={t} />
      </section>
    </>
  );
}
