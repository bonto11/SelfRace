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

/* ─── SPARKLINE ─── */
function HRVSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const W = 100;
  const H = 26;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const [lastX, lastY] = pts.at(-1)!.split(",").map(Number);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts.join(" ")} fill="none"
        stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} opacity={0.9} />
    </svg>
  );
}

/* ─── TREND ARROW ─── */
function TrendArrow({ direction, color }: { direction: "up" | "down" | "stable"; color: string }) {
  return (
    <span style={{ fontSize: 15, fontWeight: 700, color, marginLeft: 5, alignSelf: "center" }}>
      {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
    </span>
  );
}

/* ─── HELPERS ─── */
function accentToColor(accent: unknown, fallback: string): string {
  const a = String(accent ?? "").toLowerCase();
  if (a.includes("red"))    return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return "#4ade80";
  return fallback;
}
function accentToCardAccent(accent: unknown, showNA: boolean): string {
  if (showNA) return appColors.stateNeutral;
  const a = String(accent ?? "").toLowerCase();
  if (a.includes("red"))    return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
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

  // Dnešná hodnota (posledná v poli)
  const todayVal = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // 14-dňový priemer (baseline) — počítame zo všetkých dostupných hodnôt
  const baseline = useMemo<number | null>(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 3) return null;
    // Priemer posledných 14 (alebo menej ak ich je menej)
    const window = nums.slice(-14);
    return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
  }, [values]);

  // Sparkline — posledných 7 nenullových hodnôt (vrátane dnešnej ak existuje)
  const sparkValues = useMemo<number[]>(
    () => values.filter((v): v is number => v !== null).slice(-7),
    [values],
  );

  // Trend: posledné 3 vs predchádzajúce 3 dostupné hodnoty
  const trend = useMemo<"up" | "down" | "stable">(() => {
    if (sparkValues.length < 4) return "stable";
    const recent = sparkValues.slice(-3);
    const older  = sparkValues.slice(-6, -3);
    if (!older.length) return "stable";
    const ra = recent.reduce((a, b) => a + b, 0) / recent.length;
    const oa = older.reduce((a, b) => a + b, 0) / older.length;
    const diff = ra - oa;
    if (diff >  2) return "up";
    if (diff < -2) return "down";
    return "stable";
  }, [sparkValues]);

  // Porovnanie dnešnej hodnoty s bézlínou (len ak máme dnes dáta)
  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const hasToday = freshness.hasToday && todayVal !== null;

  const cmp = compareLatestToBaseline(todayVal, baseline, "higher-better", 0.05, t);
  const trendColor = accentToColor(
    hasToday ? (cmp as any)?.accent : trend === "up" ? "green" : trend === "down" ? "red" : "",
    appColors.textMuted,
  );
  const cardAccent = accentToCardAccent(hasToday ? (cmp as any)?.accent : null, false);

  const valueText = hasToday ? String(Math.round(todayVal!)) : "—";
  const note = hasToday
    ? cmp.note
    : sparkValues.length > 0
    ? t("HRV.widget.noData")
    : t("HRV.widget.noData");

  // Nemáme žiadne dáta vôbec
  const hasAnyData = sparkValues.length >= 2;

  return (
    <WidgetCard
      title={t("HRV.widget.title")}
      tooltip={t("HRV.widget.tooltip")}
      accent={cardAccent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <>
          {/* ── Hodnota + šípka ── */}
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.ms")}</span>
            {hasAnyData && (
              <TrendArrow direction={trend} color={trendColor} />
            )}
          </div>

          {/* ── Priemer (baseline) — vždy ak ho máme ── */}
          {baseline !== null && (
            <div style={{
              display: "flex", alignItems: "baseline", gap: 3,
              marginTop: 2, marginBottom: 6,
            }}>
              <span style={{ fontSize: 11, color: appColors.textMuted, opacity: 0.7 }}>
                ø
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: appColors.textMuted }}>
                {baseline}
              </span>
              <span style={{ fontSize: 11, color: appColors.textMuted, opacity: 0.7 }}>
                {t("common.units.ms")}
              </span>
              <span style={{ fontSize: 10, color: appColors.textMuted, opacity: 0.5, marginLeft: 2 }}>
                14d
              </span>
            </div>
          )}

          {/* ── Sparkline — vždy ak máme aspoň 2 hodnoty ── */}
          {hasAnyData && (
            <div style={{ marginBottom: 4, opacity: 0.85 }}>
              <HRVSparkline values={sparkValues} color={trendColor} />
            </div>
          )}

          {/* ── Poznámka ── */}
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
