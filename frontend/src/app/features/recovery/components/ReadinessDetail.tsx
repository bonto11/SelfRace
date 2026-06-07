// src/app/features/recovery/components/ReadinessDetail.tsx
"use client";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import {
  useReadinessScore, readinessColor, readinessLabelKey,
} from "@/app/shared/hooks/useReadinessScore";
import { minutesToHHMM_Time } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  CARD, SURFACE_CARD_STYLE,
  PANEL_SECTION_TITLE, PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─── KRUH SO SKÓRE ─── */
function ScoreCircle({ score }: { score: number | null }) {
  const t = useT();
  const color = readinessColor(score);
  const pct   = score ?? 0;
  const R     = 54;
  const CIRC  = 2 * Math.PI * R;
  const dash  = (pct / 100) * CIRC;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 16px" }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={64} cy={64} r={R} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
        <circle cx={64} cy={64} r={R} fill="none"
          stroke={color} strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRC - dash}`}
          strokeDashoffset={CIRC / 4} />
        <text x={64} y={60} textAnchor="middle"
          fill={score !== null ? color : appColors.textMuted}
          fontSize={26} fontWeight={700} dominantBaseline="middle">
          {score ?? "—"}
        </text>
        <text x={64} y={82} textAnchor="middle"
          fill={appColors.textMuted} fontSize={11}>/ 100</text>
      </svg>
      <span style={{ fontSize: 18, fontWeight: 700, marginTop: 6,
        color: score !== null ? color : appColors.textMuted }}>
        {t(readinessLabelKey(score))}
      </span>
    </div>
  );
}

/* ─── RIADOK KOMPONENTU ─── */
function ComponentRow({
  title, value, sub, score, note, noteColor,
}: {
  title: string; value: string; sub?: string;
  score: number | null; note?: string; noteColor?: string;
}) {
  const color = readinessColor(score);
  return (
    <div style={{ padding: "12px 16px", borderBottom: `1px solid ${appColors.divider}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: appColors.textMuted }}>{title}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: appColors.textPrimary }}>{value}</span>
          {sub && <span style={{ fontSize: 11, color: appColors.textMuted }}>{sub}</span>}
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: score !== null ? `${score}%` : "0%",
          backgroundColor: color,
        }} />
      </div>
      {note && (
        <p style={{ fontSize: 11, color: noteColor || appColors.textMuted, marginTop: 4, opacity: 0.8 }}>
          {note}
        </p>
      )}
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function ReadinessDetail() {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const result = useReadinessScore(rows);
  const c = result.components;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <LoadingSpinner size="trend" />
      </div>
    );
  }

  const hrvVal  = c.hrv.today !== null    ? `${Math.round(c.hrv.today)} ms`          : "—";
  const hrvSub  = c.hrv.baseline !== null ? `/ ø ${Math.round(c.hrv.baseline)} ms`   : undefined;
  const rhrVal  = c.rhr.today !== null    ? `${Math.round(c.rhr.today)} bpm`          : "—";
  const rhrSub  = c.rhr.baseline !== null ? `/ ø ${Math.round(c.rhr.baseline)} bpm`  : undefined;
  const sleepVal = c.sleep.today !== null ? minutesToHHMM_Time(c.sleep.today)         : "—";

  const sleepNote = c.sleep.today !== null
    ? c.sleep.today < 420 ? t("readiness.detail.sleepLow")
    : c.sleep.today > 540 ? t("readiness.detail.sleepHigh")
    : undefined
    : t("readiness.detail.noData");

  const factorsList = [
    c.factors.alcohol  && t("readiness.detail.factorAlcohol"),
    c.factors.caffeine && t("readiness.detail.factorCaffeine"),
    c.factors.food     && t("readiness.detail.factorFood"),
  ].filter(Boolean).join(" · ");

  return (
    <>
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        <ScoreCircle score={result.score} />
        {!result.hasEnough && (
          <p style={{ textAlign: "center", fontSize: 13, color: appColors.textMuted, padding: "0 16px 16px" }}>
            {t("readiness.detail.notEnoughData")}
          </p>
        )}
      </section>

      <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginTop: 12 }}>
        <div style={{ padding: "14px 16px 6px" }}>
          <div className={PANEL_SECTION_TITLE} style={{ color: appColors.textPrimary }}>
            {t("readiness.detail.breakdown")}
          </div>
          <div className={PANEL_SECTION_SUBTITLE} style={{ color: appColors.textMuted }}>
            {t("readiness.detail.breakdownSub")}
          </div>
        </div>

        <ComponentRow
          title={t("readiness.detail.hrv")}
          value={hrvVal} sub={hrvSub} score={c.hrv.score}
          note={c.hrv.score === null ? t("readiness.detail.noData") : undefined}
        />
        <ComponentRow
          title={t("readiness.detail.rhr")}
          value={rhrVal} sub={rhrSub} score={c.rhr.score}
          note={c.rhr.score === null ? t("readiness.detail.noData") : undefined}
        />
        <ComponentRow
          title={t("readiness.detail.sleep")}
          value={sleepVal} score={c.sleep.score}
          note={sleepNote}
          noteColor={c.sleep.today !== null && c.sleep.today < 420 ? appColors.stateWarning : undefined}
        />
        <ComponentRow
          title={t("readiness.detail.factors")}
          value={c.factors.score === 100 ? "✓" : `−${100 - c.factors.score}`}
          score={c.factors.score}
          note={factorsList || t("readiness.detail.noFactors")}
          noteColor={factorsList ? appColors.stateWarning : undefined}
        />
      </section>
    </>
  );
}
