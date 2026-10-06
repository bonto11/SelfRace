"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import {
  checkRecoveryFreshness,
  makeBaselinePoint,
  compareLatestToBaseline,
} from "@/app/shared/utils/recovery";
import { minutesToHHMM_Time } from "@/app/shared/utils/time";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP, WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY, WIDGET_NOTE, WIDGET_VALUE_UNIT,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/*
  Optimálny spánok podľa vedy (National Sleep Foundation):
  < 360 min (6h)   → červená  (nedostatok)
  360–419 min      → jantárová (málo)
  420–540 min (7–9h) → zelená (optimum)
  > 540 min (9h)   → jantárová (veľa — môže byť recovery, nie kritické)
*/
const SLEEP_COLORS = {
  tooLittle: appColors.stateDanger,  // < 6h
  low:       appColors.stateWarning, // 6–7h
  optimal:   "#4ade80",              // 7–9h
  high:      appColors.stateWarning, // > 9h
};

function sleepColor(minutes: number | null): string {
  if (minutes === null) return appColors.textMuted;
  if (minutes < 360) return SLEEP_COLORS.tooLittle;
  if (minutes < 420) return SLEEP_COLORS.low;
  if (minutes <= 540) return SLEEP_COLORS.optimal;
  return SLEEP_COLORS.high;
}

/* ─── SLEEP BAR CHART (7 dní) ─── */
function SleepBars({ values }: { values: (number | null)[] }) {
  if (values.length === 0) return null;

  const H = 32;       // výška celého grafu
  const DISPLAY_MIN = 240; // 4h — spodná hranica zobrazenia
  const DISPLAY_MAX = 600; // 10h — horná hranica
  const range = DISPLAY_MAX - DISPLAY_MIN;

  // Referenčné čiary: 7h (420) a 9h (540)
  const y7h = H - ((420 - DISPLAY_MIN) / range) * H;
  const y9h = H - ((540 - DISPLAY_MIN) / range) * H;

  const barW = 100 / values.length;
  const gap = 0.8; // medzera medzi barmi v %

  return (
    <svg width="100%" height={H} viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none" style={{ display: "block" }}>

      {/* Referenčné čiary 7h a 9h */}
      <line x1={0} y1={y7h} x2={100} y2={y7h}
        stroke={SLEEP_COLORS.optimal} strokeWidth={0.4} strokeDasharray="2 2" opacity={0.4} />
      <line x1={0} y1={y9h} x2={100} y2={y9h}
        stroke={SLEEP_COLORS.high} strokeWidth={0.4} strokeDasharray="2 2" opacity={0.3} />

      {/* Bary */}
      {values.map((v, i) => {
        const x = i * barW + gap / 2;
        const w = barW - gap;
        if (v === null) {
          // Chýbajúce dáta — malý placeholder
          return (
            <rect key={i} x={x} y={H - 3} width={w} height={3}
              fill={appColors.textMuted} opacity={0.2} rx={0.5} />
          );
        }
        const clamped = Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX, v));
        const barH = Math.max(2, ((clamped - DISPLAY_MIN) / range) * H);
        const color = sleepColor(v);
        return (
          <rect key={i} x={x} y={H - barH} width={w} height={barH}
            fill={color} opacity={0.75} rx={0.8} />
        );
      })}
    </svg>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function WidgetSleepDuration({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading: loadingRaw } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const loading = !!loadingRaw;
  const t = useT();

  const values = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : null)),
    [rows],
  );

  const latest = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  // 14d priemer
  const baseline = useMemo<number | null>(() => {
    const nums = values.filter((v): v is number => v !== null);
    if (nums.length < 3) return null;
    const w = nums.slice(-14);
    return Math.round(w.reduce((a, b) => a + b, 0) / w.length);
  }, [values]);

  const baselinePoint = useMemo(() => makeBaselinePoint(values, 14, true), [values]);
  const cmp = compareLatestToBaseline(latest, baselinePoint, "higher-better", 0.05, t);

  // Posledných 7 dní pre bar chart (vrátane null = chýbajúce dáta)
  const last7 = useMemo(() => values.slice(-7), [values]);

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const hasToday = freshness.hasToday && latest !== null;
  const hasAnyData = values.some((v) => v !== null);

  const todayColor = sleepColor(latest);
  const valueText = hasToday ? minutesToHHMM_Time(latest!) : "—";
  const note = hasToday ? cmp.note : t("sleepDuration.widget.noData");

  // Card accent: podľa kvality spánku dnes
  const accent = (() => {
    if (!hasToday) return appColors.stateNeutral;
    if (latest! < 360) return appColors.stateDanger;
    if (latest! < 420) return appColors.stateWarning;
    return "none";
  })();

  return (
    <WidgetCard
      title={t("sleepDuration.widget.title")}
      tooltip={t("sleepDuration.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <>
          {/* Hodnota + farba podľa sleep zone */}
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span className={WIDGET_VALUE_PRIMARY}
              style={{ color: hasToday ? todayColor : undefined }}>
              {valueText}
            </span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.hour")}</span>
          </div>

          {/* 14d priemer */}
          {baseline !== null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 2, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: appColors.textMuted, opacity: 0.7 }}>ø</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: appColors.textMuted }}>
                {minutesToHHMM_Time(baseline)}
              </span>
              <span style={{ fontSize: 10, color: appColors.textMuted, opacity: 0.5, marginLeft: 2 }}>14d</span>
            </div>
          )}

          {/* Bar chart — 7 dní, farebné podľa sleep zone */}
          {hasAnyData && (
            <div style={{ marginBottom: 4 }}>
              <SleepBars values={last7} />
              {/* Legendička */}
              <div style={{ display: "flex", justifyContent: "space-between",
                marginTop: 2, fontSize: 9, color: appColors.textMuted, opacity: 0.5 }}>
                <span>7h</span>
                <span>9h</span>
              </div>
            </div>
          )}

          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}
