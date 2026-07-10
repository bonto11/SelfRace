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
  if (!allValid.length) return [40, 80];
  const dataMin = Math.min(...allValid);
  const dataMax = Math.max(...allValid);
  return [Math.max(30, Math.floor(dataMin) - 5), Math.ceil(dataMax) + 5];
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

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 1h4M1 1v4M15 1h-4M15 1v4M1 15h4M1 15v-4M15 15h-4M15 15v-4"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/* ─── SHARED CHART SERIES ─── */
interface ChartInnerProps {
  chartData: any[];
  yMin: number; yMax: number;
  tickInterval: number;
  yAxisLabel: string;
  COLOR: { main: string; bandFill: string; missing: string };
  t: any;
  showLegend?: boolean;
}

function ChartInner({ chartData, yMin, yMax, tickInterval, yAxisLabel, COLOR, t, showLegend = true }: ChartInnerProps) {
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
        label={{ value: yAxisLabel, angle: -90, position: "insideLeft",
          fill: appColors.textMuted, fontSize: 10, dy: 30 }} />
      <Tooltip content={<RecoveryTooltip t={t} />}
        cursor={{ stroke: appColors.textMuted, strokeWidth: 1, strokeDasharray: "5 5" }} />
      {showLegend && (
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
      )}
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

/* ─── FULLSCREEN OVERLAY ─── */
interface FullscreenOverlayProps extends ChartInnerProps {
  onClose: () => void;
  weeks: number;
  onWeeksChange: (v: number) => void;
  loading: boolean;
}

function FullscreenOverlay(props: FullscreenOverlayProps) {
  const { onClose, chartData, yMin, yMax, tickInterval, yAxisLabel,
    COLOR, t, weeks, onWeeksChange, loading } = props;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Priamy DOM prístup — najistejší spôsob skrytia nav baru
    // MobileBottomBar má id="mobile-bottom-nav"
    const nav = document.getElementById("mobile-bottom-nav");
    if (nav) nav.style.setProperty("display", "none", "important");

    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);

    return () => {
      if (nav) nav.style.removeProperty("display");
      window.removeEventListener("keydown", h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlay = (
    <div onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        zIndex: 99999,
        backgroundColor: "#071610",
        display: "flex", flexDirection: "column",
      }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, display: "flex", flexDirection: "column",
          padding: "16px 16px 0 16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          minHeight: 0, boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center",
          marginBottom: 10, flexShrink: 0, gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
              {t("recovery.trends.rhr.title")}
            </div>
          </div>
          
