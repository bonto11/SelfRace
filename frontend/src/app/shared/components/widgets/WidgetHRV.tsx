"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useT } from "@/app/shared/i18n/useT";

import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

/* ─── MINI SPARKLINE (posledných 7 dní HRV) ─── */
function HRVSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const W = 100;
  const H = 28;
  const pad = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = pts.join(" ");
  // Posledný bod (dnešná hodnota)
  const [lastX, lastY] = pts.at(-1)!.split(",").map(Number);

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      {/* Posledná hodnota — plný bodík */}
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} opacity={0.9} />
    </svg>
  );
}

/* ─── TREND ARROW ─── */
function TrendArrow({ direction, color }: { direction: "up" | "down" | "stable"; color: string }) {
  const symbol = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  return (
    <span style={{
      fontSize: 16,
      fontWeight: 700,
      color,
      marginLeft: 6,
      lineHeight: 1,
      alignSelf: "center",
    }}>
      {symbol}
    </span>
  );
}

/* ─── ACCENT → farba pre sparkline/arrow ─── */
function pickColor(accent: unknown, showNA: boolean): string {
  if (showNA) return appColors.textMuted;
  const a = String(accent ?? "").toLowerCase();
  if (a.includes("red")) return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return appColors.stateGood ?? "#4ade80";
  return appColors.textMuted;
}

function pickAccentFromCmp(cmpAccent: unknown, opts: { loading: boolean; showNA: boolean }) {
  if (opts.loading || opts.showNA) return appColors.stateNeutral;
  const a = String(cmpAccent ?? "").toLowerCase();
  if (a.includes("red")) return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return "none";
  return "none";
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function WidgetHRV({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading: loadingRaw } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const loading = !!loadingRaw;
  const t = useT();

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)),
    [rows],
  );

  const yesterday = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  const cmp = compareLatestToBaseline(yesterday, baselinePoint, "higher-better", 0.05, t);

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  // Posledných 7 nenullových HRV hodnôt pre sparkline
  const sparklineValues = useMemo<number[]>(() => {
    return values.filter((v): v is number => v !== null).slice(-7);
  }, [values]);

  // Trend: porovnaj posledné 3 dni vs predchádzajúce
  const trendDirection = useMemo<"up" | "down" | "stable">(() => {
    if (sparklineValues.length < 4) return "stable";
    const recent = sparklineValues.slice(-3);
    const older = sparklineValues.slice(-6, -3);
    if (!older.length) return "stable";
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff > 2) return "up";
    if (diff < -2) return "down";
    return "stable";
  }, [sparklineValues]);

  const valueText = showNA
    ? "—"
    : Number.isFinite(yesterday)
    ? String(Math.round(yesterday as number))
    : "—";

  const note = showNA ? t("HRV.widget.noData") : cmp.note;
  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });
  const trendColor = pickColor((cmp as any)?.accent, showNA);

  return (
    <WidgetCard
      title={t("HRV.widget.title")}
      tooltip={t("HRV.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          {/* Hodnota + šípka trendu */}
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline" }}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.ms")}</span>
            {!showNA && sparklineValues.length >= 3 && (
              <TrendArrow direction={trendDirection} color={trendColor} />
            )}
          </div>

          {/* Sparkline — 7 dní */}
          {!showNA && sparklineValues.length >= 2 && (
            <div style={{ marginTop: 8, marginBottom: 4, opacity: 0.85 }}>
              <HRVSparkline values={sparklineValues} color={trendColor} />
            </div>
          )}

          {/* Poznámka */}
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
