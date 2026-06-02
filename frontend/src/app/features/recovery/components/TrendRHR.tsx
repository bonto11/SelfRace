"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  CARD,
  SURFACE_CARD_STYLE,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { EventsIcon, TooltipEvents, EventsLegend } from "@/app/shared/charts/RecoveryEvents";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function getLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end   = new Date(endISO   + "T00:00:00");
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(getLocalISODate(d));
  }
  return out;
}

/* ─────────────────────────────────────────────
   TOOLTIP
───────────────────────────────────────────── */
const RecoveryTooltip = ({ active, payload, label, t }: any) => {
  if (!active || !payload?.length) return null;

  const mainData    = payload.find((p: any) => p.dataKey === "val");
  const missingData = payload.find((p: any) => p.dataKey === "missingY");
  const comments    = payload[0]?.payload?.comments;

  return (
    <div
      className="p-3 rounded-xl border shadow-xl backdrop-blur-md max-w-xs"
      style={{ backgroundColor: "rgba(9, 24, 18, 0.92)", borderColor: appColors.panelBorder }}
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
        <div
          className="mt-2 pt-2 border-t text-[11px] opacity-70 italic whitespace-pre-wrap"
          style={{ borderColor: appColors.divider }}
        >
          {wrapToLines(comments, 44).join("\n")}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   LANDSCAPE OVERLAY
───────────────────────────────────────────── */
interface LandscapeOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
}

function LandscapeOverlay({ onClose, children }: LandscapeOverlayProps) {
  // Lock orientation on open, unlock on close
  useEffect(() => {
    const tryLock = async () => {
      try {
        await (screen.orientation as any)?.lock?.("landscape-primary");
      } catch {
        // iOS alebo browser bez podpory — CSS transform to dorieši
      }
    };
    tryLock();
    return () => {
      try { (screen.orientation as any)?.unlock?.(); } catch {}
    };
  }, []);

  // Zatvoriť na Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "#071610",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // CSS transform trik pre iOS kde orientation.lock nefunguje
      }}
    >
      {/* Rotovaný kontajner — simuluje landscape aj na portrait telefóne */}
      <div
        style={{
          transform: "rotate(90deg)",
          transformOrigin: "center center",
          width: "100vh",
          height: "100vw",
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px 12px 20px",
        }}
      >
        {/* Zatvoriť tlačidlo — v landscape bude vpravo hore */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            // Po rotácii: "top" sa stane "right strana" vizuálne
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${appColors.panelBorder}`,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: appColors.textPrimary,
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 1,
          }}
          aria-label="Zatvoriť"
        >
          ✕
        </button>

        {/* Obsah grafu */}
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HLAVNÝ CHART OBSAH (zdieľaný medzi normal a landscape)
───────────────────────────────────────────── */
interface ChartContentProps {
  chartData: any[];
  yMin: number;
  yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  loading: boolean;
  COLOR: { main: string; bandFill: string; missing: string };
  t: any;
  chartHeight: number;
  weeks: number;
  onWeeksChange: (v: number) => void;
  isLandscape?: boolean;
}

function ChartContent({
  chartData, yMin, yMax, tickInterval, yAxisLabel,
  loading, COLOR, t, chartHeight, weeks, onWeeksChange, isLandscape = false,
}: ChartContentProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header s titulom a selectom */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        <div>
          <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
            {t("recovery.trends.rhr.title")}
          </div>
          {!isLandscape && (
            <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>
              {t("recovery.trends.rhr.subtitle")}
            </div>
          )}
        </div>

        <SelectField
          value={String(weeks)}
          onChange={(e) => onWeeksChange(Number(e.target.value))}
          options={WEEK_OPTIONS(t)}
          variant="editable"
          containerClassName="w-[120px]"
        />
      </div>

      {/* Graf */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {loading && (
          <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
            <LoadingSpinner size="trend" />
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%" minWidth={1}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />

            <XAxis
              dataKey="date"
              interval={tickInterval}
              tick={{ fill: appColors.textMuted, fontSize: isLandscape ? 11 : 10 }}
              axisLine={false}
              tickLine={false}
              dy={8}
              tickFormatter={(val) =>
                new Date(val).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })
              }
            />

            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: appColors.textMuted, fontSize: isLandscape ? 11 : 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: "insideLeft",
                fill: appColors.textMuted,
                fontSize: 10,
                dy: 30,
              }}
            />

            <Tooltip
              content={<RecoveryTooltip t={t} />}
              cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }}
            />

            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
            />

            <Area
              type="monotone"
              dataKey="bandRange"
              stroke="none"
              fill={COLOR.bandFill}
              fillOpacity={1}
              legendType="none"
              connectNulls
            />

            <Line
              type="monotone"
              dataKey="val"
              name={t("recovery.trends.rhr.rhrLabel") as string}
              stroke={COLOR.main}
              strokeWidth={3}
              dot={{ r: isLandscape ? 4 : 3, fill: COLOR.main, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              connectNulls
            />

            <Scatter
              dataKey="missingY"
              name={t("recovery.trends.rhr.missingLabel") as string}
              fill={COLOR.missing}
              r={4}
            />

            <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />

            <Brush
              dataKey="date"
              height={26}
              travellerWidth={10}
              stroke={appColors.panelBorder}
              fill="#0a1f14"
              tickFormatter={(val) =>
                new Date(val).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })
              }
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HLAVNÝ KOMPONENT
───────────────────────────────────────────── */
export default function TrendRHR() {
  const t = useT();
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const COLOR = {
    main: appColors.chartLine1,
    bandFill: appColors.chartBandFill,
    missing: appColors.stateBad,
  };

  useEffect(() => {
    setLoading(true);
    const tt = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(tt);
  }, [weeks, all]);

  const days   = weeks * 7;
  const endISO = useMemo(() => isMounted ? getLocalISODate(new Date()) : getLocalISODate(new Date()), [isMounted]);
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setDate(d.getDate() - (days - 1));
    return getLocalISODate(d);
  }, [endISO, days]);

  const byDate = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const r of all) m.set(r.date, r);
    return m;
  }, [all]);

  const labelsISO = useMemo(() => dateSeq(startISO, endISO), [startISO, endISO]);

  const rhr = useMemo(
    () => labelsISO.map((d) => {
      const rec = byDate.get(d);
      return typeof rec?.RHR_bpm === "number" ? rec.RHR_bpm : NaN;
    }),
    [labelsISO, byDate],
  );

  const baselineArr = useMemo(
    () => rollingMean(rhr.map((v) => (Number.isFinite(v) ? (v as number) : null)), 14),
    [rhr],
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const missingY = useMemo(() => {
    const n = rhr.length;
    const out = new Array<number | null>(n).fill(null);
    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(rhr[i])) last = i;
      nextKnown[i] = last;
    }
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(rhr[i])) { prev = i; continue; }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = rhr[prev] as number;
        const vn = rhr[nxt] as number;
        y = vp + (vn - vp) * ((i - prev) / (nxt - prev));
      } else if (prev !== -1) y = rhr[prev] as number;
      else if (nxt !== -1) y = rhr[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [rhr]);

  const chartData = useMemo(() => {
    return labelsISO.map((d, i) => {
      const v        = rhr[i];
      const isMissing = !Number.isFinite(v);
      const hasBand  = lower[i] != null && upper[i] != null;
      const rec       = byDate.get(d);
      const hasAlcohol  = !!rec?.alcohol_consumed;
      const hasFood     = !!rec?.food_2h_before;
      const hasCaffeine = !!rec?.caffeine_8h;
      const hasAnyEvent = hasAlcohol || hasFood || hasCaffeine;
      const eventsYPos  = isMissing ? missingY[i] : v;
      return {
        date: d,
        val: isMissing ? null : v,
        bandRange: hasBand ? [lower[i], upper[i]] : null,
        missingY: isMissing ? missingY[i] : null,
        comments: rec?.comments,
        hasAlcohol, hasFood, hasCaffeine,
        eventsY: hasAnyEvent ? eventsYPos : null,
      };
    });
  }, [labelsISO, rhr, lower, upper, missingY, byDate]);

  if (!isMounted) return null;

  const validValues = [
    ...rhr.filter(Number.isFinite),
    ...lower.filter((v): v is number => v !== null),
    ...upper.filter((v): v is number => v !== null),
  ];
  const minValue = validValues.length ? Math.min(...validValues) : 40;
  const maxValue = validValues.length ? Math.max(...validValues) : 80;
  const yMin = Math.max(30, Math.floor((minValue - 10) / 5) * 5);
  const yMax = Math.ceil((maxValue + 5) / 5) * 5;
  const yAxisLabel = `[${t("common.units.hr")}]`;
  const tickInterval = weeks <= 2 ? 2 : weeks <= 4 ? 3 : weeks <= 8 ? 6 : 13;

  const sharedProps = {
    chartData, yMin, yMax, tickInterval, yAxisLabel,
    loading, COLOR, t, weeks, onWeeksChange: setWeeks,
  };

  return (
    <>
      {/* ── Landscape fullscreen overlay ── */}
      {isLandscape && (
        <LandscapeOverlay onClose={() => setIsLandscape(false)}>
          <ChartContent
            {...sharedProps}
            chartHeight={0}
            isLandscape
          />
        </LandscapeOverlay>
      )}

      {/* ── Normálna karta ── */}
      <section
        className={CARD + " relative pb-2"}
        style={SURFACE_CARD_STYLE}
      >
        {/* Header — titul + expand tlačidlo + select */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
            gap: 8,
          }}
        >
          {/* Titul + subtitle */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
              {t("recovery.trends.rhr.title")}
            </div>
            <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>
              {t("recovery.trends.rhr.subtitle")}
            </div>
          </div>

          {/* Expand tlačidlo + Select */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Expand / landscape tlačidlo */}
            <button
              onClick={() => setIsLandscape(true)}
              title="Zobraziť na celú obrazovku"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: `1px solid ${appColors.panelBorder}`,
                backgroundColor: "rgba(255,255,255,0.05)",
                color: appColors.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {/* Expand ikona — štyri šípky smerom von */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1h4M1 1v4M15 1h-4M15 1v4M1 15h4M1 15v-4M15 15h-4M15 15v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
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
          <div style={{ width: "100%", position: "relative", height: 340 }}>
            {loading && (
              <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
                <LoadingSpinner size="trend" />
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={appColors.chartGrid} />

                <XAxis
                  dataKey="date"
                  interval={tickInterval}
                  tick={{ fill: appColors.textMuted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                  tickFormatter={(val) =>
                    new Date(val).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })
                  }
                />

                <YAxis
                  domain={[yMin, yMax]}
                  tick={{ fill: appColors.textMuted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: appColors.textMuted,
                    fontSize: 10,
                    dy: 30,
                  }}
                />

                <Tooltip
                  content={<RecoveryTooltip t={t} />}
                  cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }}
                />

                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />

                <Area
                  type="monotone"
                  dataKey="bandRange"
                  stroke="none"
                  fill={COLOR.bandFill}
                  fillOpacity={1}
                  legendType="none"
                  connectNulls
                />

                <Line
                  type="monotone"
                  dataKey="val"
                  name={t("recovery.trends.rhr.rhrLabel") as string}
                  stroke={COLOR.main}
                  strokeWidth={3}
                  dot={{ r: 3, fill: COLOR.main, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />

                <Scatter
                  dataKey="missingY"
                  name={t("recovery.trends.rhr.missingLabel") as string}
                  fill={COLOR.missing}
                  r={4}
                />

                <Scatter dataKey="eventsY" shape={<EventsIcon />} legendType="none" tooltipType="none" />

                <Brush
                  dataKey="date"
                  height={26}
                  travellerWidth={10}
                  stroke={appColors.panelBorder}
                  fill="#0a1f14"
                  tickFormatter={(val) =>
                    new Date(val).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" })
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <EventsLegend t={t} />
      </section>
    </>
  );
}
