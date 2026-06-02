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
  while (cur <= end) {
    out.push(getLocalISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ─── TOOLTIP ─── */
const RecoveryTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;
  const mainData    = payload.find((p: any) => p.dataKey === "val");
  const missingData = payload.find((p: any) => p.dataKey === "missingY");
  const comments    = payload[0]?.payload?.comments;
  return (
    <div
      className="p-3 rounded-xl border shadow-xl backdrop-blur-md max-w-xs"
      style={{ backgroundColor: "rgba(9,24,18,0.95)", borderColor: appColors.panelBorder }}
    >
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

/* ─── CHART RENDERER — rovnaký kód pre normal aj landscape ─── */
interface RHRChartProps {
  chartData: any[];
  yMin: number; yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  loading: boolean;
  COLOR: { main: string; bandFill: string; missing: string };
  t: any;
  height: number; // explicitná výška — landscape dostane viac
}

function RHRChart({ chartData, yMin, yMax, tickInterval, yAxisLabel, loading, COLOR, t, height }: RHRChartProps) {
  return (
    /* FIX: outline:none + tap-highlight:transparent odstraňuje modrý rámček */
    <div
      style={{ width: "100%", height, position: "relative", outline: "none", WebkitTapHighlightColor: "transparent" }}
      tabIndex={-1}
    >
      {loading && (
        <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
          <LoadingSpinner size="trend" />
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />

          <XAxis
            dataKey="date"
            interval={tickInterval}
            tick={{ fill: appColors.textMuted, fontSize: 10 }}
            axisLine={false} tickLine={false} dy={8}
            tickFormatter={(v) => new Date(v).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })}
          />

          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: appColors.textMuted, fontSize: 10 }}
            axisLine={false} tickLine={false}
            label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: appColors.textMuted, fontSize: 10, dy: 30 }}
          />

          <Tooltip
            content={<RecoveryTooltip t={t} />}
            cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }}
          />

          <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />

          <Area type="monotone" dataKey="bandRange"
            stroke="none" fill={COLOR.bandFill} fillOpacity={1} legendType="none" connectNulls />

          <Line type="monotone" dataKey="val"
            name={t("recovery.trends.rhr.rhrLabel") as string}
            stroke={COLOR.main} strokeWidth={3}
            dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            connectNulls />

          <Scatter dataKey="missingY"
            name={t("recovery.trends.rhr.missingLabel") as string}
            fill={COLOR.missing} r={4} />

          <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />

          <Brush
            dataKey="date" height={26} travellerWidth={10}
            stroke={appColors.panelBorder} fill="#0a1f14"
            tickFormatter={(v) => new Date(v).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── LANDSCAPE OVERLAY ─── */
interface LandscapeOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
}

function LandscapeOverlay({ onClose, children }: LandscapeOverlayProps) {
  useEffect(() => {
    // Pokus o lock — funguje na Android PWA, iOS ignoruje
    (screen.orientation as any)?.lock?.("landscape-primary").catch?.(() => {});
    return () => { (screen.orientation as any)?.unlock?.(); };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    // FIX: klik na pozadie = zatvoriť
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "#071610" }}
    >
      {/*
        CSS transform trick pre iOS kde orientation.lock nefunguje:
        - div má rozmery 100vh × 100vw (pred rotáciou)
        - po rotate(90deg) vyzerá ako landscape (100vw × 100vh)
        - translate(-50%, -50%) + top/left 50% ho centruje
      */}
      <div
        onClick={(e) => e.stopPropagation()} // klik vnútri nezatvára overlay
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "100vh",
          height: "100vw",
          transform: "translate(-50%, -50%) rotate(90deg)",
          transformOrigin: "center center",
          display: "flex",
          flexDirection: "column",
          padding: "12px 16px 8px 16px",
          boxSizing: "border-box",
        }}
      >
        {/* Zatvoriť — vizuálne vpravo hore po rotácii */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12, right: 12,
            width: 34, height: 34,
            borderRadius: "50%",
            border: `1px solid ${appColors.panelBorder}`,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: appColors.textPrimary,
            fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            zIndex: 1,
            outline: "none",
          }}
        >
          ✕
        </button>

        {children}
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
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
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
    labelsISO.map((d) => {
      const rec = byDate.get(d);
      return typeof rec?.RHR_bpm === "number" ? rec.RHR_bpm : NaN;
    }),
    [labelsISO, byDate],
  );

  const baselineArr = useMemo(() => rollingMean(rhr.map((v) => Number.isFinite(v) ? (v as number) : null), 14), [rhr]);
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const missingY = useMemo(() => {
    const n = rhr.length;
    const out = new Array<number | null>(n).fill(null);
    const nextKnown = new Array<number>(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) { if (Number.isFinite(rhr[i])) last = i; nextKnown[i] = last; }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(rhr[i])) { prev = i; continue; }
      const nxt = nextKnown[i];
      if (prev !== -1 && nxt !== -1) {
        out[i] = (rhr[prev] as number) + ((rhr[nxt] as number) - (rhr[prev] as number)) * ((i - prev) / (nxt - prev));
      } else if (prev !== -1) out[i] = rhr[prev] as number;
      else if (nxt !== -1)  out[i] = rhr[nxt] as number;
    }
    return out;
  }, [rhr]);

  const chartData = useMemo(() => labelsISO.map((d, i) => {
    const v = rhr[i];
    const isMissing = !Number.isFinite(v);
    const rec = byDate.get(d);
    const hasAlcohol  = !!rec?.alcohol_consumed;
    const hasFood     = !!rec?.food_2h_before;
    const hasCaffeine = !!rec?.caffeine_8h;
    return {
      date: d,
      val: isMissing ? null : v,
      bandRange: lower[i] != null && upper[i] != null ? [lower[i], upper[i]] : null,
      missingY: isMissing ? missingY[i] : null,
      comments: rec?.comments,
      hasAlcohol, hasFood, hasCaffeine,
      eventsY: (hasAlcohol || hasFood || hasCaffeine) ? (isMissing ? missingY[i] : v) : null,
    };
  }), [labelsISO, rhr, lower, upper, missingY, byDate]);

  if (!isMounted) return null;

  const allValid = [...rhr.filter(Number.isFinite), ...lower.filter((v): v is number => v !== null), ...upper.filter((v): v is number => v !== null)];
  const yMin = allValid.length ? Math.max(30, Math.floor((Math.min(...allValid) - 10) / 5) * 5) : 40;
  const yMax = allValid.length ? Math.ceil((Math.max(...allValid) + 5) / 5) * 5 : 80;
  const yAxisLabel   = `[${t("common.units.hr")}]`;
  const tickInterval = weeks <= 2 ? 2 : weeks <= 4 ? 3 : weeks <= 8 ? 6 : 13;

  const sharedChartProps = { chartData, yMin, yMax, tickInterval, yAxisLabel, loading, COLOR, t };

  return (
    <>
      {/* ── Landscape fullscreen overlay ── */}
      {showLandscape && (
        <LandscapeOverlay onClose={() => setShowLandscape(false)}>
          {/* Titul v landscape */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8, paddingRight: 44 }}>
            <div>
              <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary, fontSize: 14 }}>
                {t("recovery.trends.rhr.title")}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <SelectField
                value={String(weeks)}
                onChange={(e) => setWeeks(Number(e.target.value))}
                options={WEEK_OPTIONS(t)}
                variant="editable"
                containerClassName="w-[110px]"
              />
            </div>
          </div>

          {/* Graf zaberá zvyšok priestoru v landscape */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <RHRChart {...sharedChartProps} height={500} />
          </div>
        </LandscapeOverlay>
      )}

      {/* ── Normálna karta ── */}
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
            {/* Expand tlačidlo */}
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
              }}
            >
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

        {/* Graf */}
        <div style={{ padding: "0 12px 8px 12px" }}>
          <RHRChart {...sharedChartProps} height={340} />
        </div>

        <EventsLegend t={t} />
      </section>
    </>
  );
}
