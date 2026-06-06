"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import {
  WIDGET_LOADING_WRAP, WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY, WIDGET_VALUE_UNIT, WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

/* ─── SPARKLINE ─── */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 100, H = 26, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lx, ly] = pts.at(-1)!.split(",").map(Number);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none"
        stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <circle cx={lx} cy={ly} r={2.5} fill={color} opacity={0.9} />
    </svg>
  );
}

/* ─── HELPERS ─── */
// RHR: "lower-better" → klesajúci trend je DOBRÝ (zelený), stúpajúci zlý (červený)
function rhrTrendColor(direction: "up" | "down" | "stable"): string {
  if (direction === "down") return "#4ade80"; // klesá = dobré
  if (direction === "up")   return appColors.stateDanger; // stúpa = zlé
  return appColors.textMuted;
}

// Pre card accent: vyšší RHR ako priemer = red, nižší = green(none)
function rhrAccent(cmpAccent: unknown, showNA: boolean): string {
  if (showNA) return appColors.stateNeutral;
  const a = String(cmpAccent ?? "").toLowerCase();
  if (a.includes("red"))    return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  return "none";
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function WidgetRHR({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading: loadingRaw } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const loading = !!loadingRaw;
  const t = useT();

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
    [rows],
  );

  const todayVal = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // 14d priemer (len priemer, nie rolling baseline pre widget)
  const baseline = useMemo<number | null>(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 3) return null;
    const w = nums.slice(-14);
    return Math.round(w.reduce((a, b) => a + b, 0) / w.length);
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const win = values.slice(0, -1);
    const { baseline: bl } = makeRollingBaseline(win, 14, 0.05);
    const last = bl.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  const cmp = compareLatestToBaseline(todayVal, baselinePoint, "lower-better", 0.05, t);

  const sparkValues = useMemo<number[]>(
    () => values.filter((v): v is number => v !== null).slice(-7),
    [values],
  );

  // Trend: RHR klesajúci = dobrý
  const trend = useMemo<"up" | "down" | "stable">(() => {
    if (sparkValues.length < 4) return "stable";
    const recent = sparkValues.slice(-3);
    const older  = sparkValues.slice(-6, -3);
    if (!older.length) return "stable";
    const ra = recent.reduce((a, b) => a + b, 0) / recent.length;
    const oa = older.reduce((a, b) => a + b, 0) / older.length;
    if (ra - oa < -1) return "down"; // klesá
    if (ra - oa >  1) return "up";   // stúpa
    return "stable";
  }, [sparkValues]);

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const hasToday = freshness.hasToday && todayVal !== null;
  const hasAnyData = sparkValues.length >= 2;

  const trendColor = rhrTrendColor(trend);
  const cardAccent = rhrAccent(hasToday ? (cmp as any)?.accent : null, false);
  const valueText = hasToday ? String(Math.round(todayVal!)) : "—";
  const note = hasToday ? cmp.note : t("RHR.widget.noData");

  // Šípka: pre RHR smer šípky ukazuje faktický smer (↓ dobrý)
  const arrowSymbol = trend === "down" ? "↓" : trend === "up" ? "↑" : "→";

  return (
    <WidgetCard
      title={t("RHR.widget.title")}
      tooltip={t("RHR.widget.tooltip")}
      accent={cardAccent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.hr")}</span>
            {hasAnyData && (
              <span style={{ fontSize: 15, fontWeight: 700, color: trendColor, marginLeft: 5, alignSelf: "center" }}>
                {arrowSymbol}
              </span>
            )}
          </div>

          {baseline !== null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: appColors.textMuted, opacity: 0.7 }}>ø</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: appColors.textMuted }}>{baseline}</span>
              <span style={{ fontSize: 11, color: appColors.textMuted, opacity: 0.7 }}>{t("common.units.hr")}</span>
              <span style={{ fontSize: 10, color: appColors.textMuted, opacity: 0.5, marginLeft: 2 }}>14d</span>
            </div>
          )}

          {hasAnyData && (
            <div style={{ marginBottom: 4, opacity: 0.85 }}>
              <Sparkline values={sparkValues} color={trendColor} />
            </div>
          )}

          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
