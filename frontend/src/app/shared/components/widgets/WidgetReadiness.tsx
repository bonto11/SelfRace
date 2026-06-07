// src/app/shared/components/widgets/WidgetReadiness.tsx
"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import { useReadinessScore, readinessColor } from "@/app/shared/hooks/useReadinessScore";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP, WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY, WIDGET_VALUE_UNIT, WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─── PROGRESS BAR ─── */
function ReadinessBar({ score }: { score: number | null }) {
  const color = readinessColor(score);
  const pct   = score ?? 0;
  return (
    <div style={{
      width: "100%", height: 6, borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.08)",
      marginTop: 8, marginBottom: 6, overflow: "hidden",
    }}>
      <div style={{
        height: "100%", borderRadius: 3,
        width: `${pct}%`,
        backgroundColor: color,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

/* ─── WIDGET ─── */
export default function WidgetReadiness({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { rows, loading } = useRecoveryData() as { rows: any[]; loading?: boolean };
  const t = useT();
  const result = useReadinessScore(rows);

  const color = readinessColor(result.score);

  const cardAccent = result.score === null
    ? appColors.stateNeutral
    : result.score < 40 ? appColors.stateDanger
    : result.score < 55 ? appColors.stateWarning
    : "none";

  return (
    <WidgetCard
      title={t("readiness.widget.title") || "Pripravenosť"}
      tooltip={t("readiness.widget.tooltip") || "Kompozitné skóre z HRV, RHR, spánku a faktorov"}
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
            <span className={WIDGET_VALUE_PRIMARY}
              style={{ color: result.hasEnough ? color : undefined }}>
              {result.score !== null ? result.score : "—"}
            </span>
            {result.score !== null && (
              <span className={WIDGET_VALUE_UNIT} style={{ color }}>/ 100</span>
            )}
          </div>

          <ReadinessBar score={result.score} />

          <p className={WIDGET_NOTE} style={{ color: result.hasEnough ? color : undefined }}>
            {result.label}
          </p>

          {/* Upozornenie na negatívne faktory */}
          {result.components.factors.alcohol && (
            <p className={WIDGET_NOTE} style={{ color: appColors.stateDanger, marginTop: 2 }}>
              🍷 {t("readiness.widget.factorAlcohol") || "Alkohol ovplyvnil skóre"}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  );
}
