// src/app/shared/components/widgets/WidgetCoachPlanSummary.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_SUB,
  WIDGET_INFO_TEXT,
  WIDGET_EMPTY_TEXT,
  WIDGET_SUMMARY_TEXT,
} from "@/app/shared/ui/tokens";

import {
  apiGetLatestPlanSummary,
  type PlanSummaryRecord,
} from "@/app/features/coach/api/coach_plan_summaries";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  onOpenDetail?: () => void;
};

function pickAccent(row: PlanSummaryRecord | null): string {
  if (!row) return "none";
  const achieved = row.raw_ai_json?.achieved_target;
  if (achieved === true) return appColors.statusSuccess;
  if (achieved === false) return appColors.stateWarning;
  return "none";
}

export default function WidgetCoachPlanSummary({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const [row, setRow] = useState<PlanSummaryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useT();

  useEffect(() => {
    if (!userId || isChecking) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestPlanSummary(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(
            t(e?.message as any) ||
              t("coachPlanSummary.widget.errorFailedLoad" as any),
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, t, isChecking]);

  const accent = useMemo(() => pickAccent(row), [row]);

  return (
    <WidgetCard
      title={t("coachPlanSummary.widget.title")}
      tooltip={t("coachPlanSummary.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading || isChecking ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>{t("widget.missingUserId")}</div>
      ) : !row ? (
        <div className={WIDGET_EMPTY_TEXT}>
          <AiUsageWarningBanner className="mb-2" />
          {t("coachPlanSummary.widget.missingData")}
        </div>
      ) : (
        <>
          {row.race_name && (
            <div className="text-xs opacity-60 mb-1">{row.race_name}</div>
          )}
          <p className={WIDGET_SUMMARY_TEXT}>
            {row.ai_headline || t("coachPlanSummary.widget.summary")}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
