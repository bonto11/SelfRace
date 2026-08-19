// src/app/features/coach/components/WidgetCoachAthleteState.tsx
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
  WIDGET_KV_GRID,
  WIDGET_KV_LABEL,
  WIDGET_KV_VALUE,
  WIDGET_SUMMARY_TEXT,
} from "@/app/shared/ui/tokens";

import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  fatigueLabel: string | null;
  injuryLabel: string | null;
  summary: string | null;
};

function extractUiState(row: AthleteStateRecord | null): UiState {
  if (!row || !row.state) {
    return {
      fatigueLabel: null,
      injuryLabel: null,
      summary: null,
    };
  }

  const s: any = row.state.ai_state
    ? row.state
    : row.state.analysis || row.state;
  const aiState = s.ai_state || {};
  const userSummary = s.user_summary || {};

  const fatigueLabel = aiState.fatigue_level || null;
  const injuryLabel = aiState.injury_risk || null;
  const summary = userSummary.headline || userSummary.short || null;

  return { fatigueLabel, injuryLabel, summary };
}

function pickAccent(ui: UiState) {
  const fat = (ui.fatigueLabel || "").toLowerCase();
  const inj = (ui.injuryLabel || "").toLowerCase();
  const hasHigh =
    fat.includes("high") ||
    inj.includes("high") ||
    fat.includes("vysok") ||
    inj.includes("vysok");
  const hasMod =
    fat.includes("moder") ||
    inj.includes("moder") ||
    fat.includes("stred") ||
    inj.includes("stred");

  if (hasHigh) return appColors.stateDanger;
  if (hasMod) return appColors.stateWarning;
  return "none";
}

export default function WidgetCoachAthleteState({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const [row, setRow] = useState<AthleteStateRecord | null>(null);
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
        const r = await apiGetLatestAthleteState(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(
            t(e?.message as any) ||
              t("coachAthleteState.widget.errorFailedLoad" as any),
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, t, isChecking]);

  const ui = useMemo(() => extractUiState(row), [row]);
  const accent = useMemo(() => pickAccent(ui), [ui]);

  const getLvl = (lvl?: string | null) => {
    if (!lvl) return "—";
    const key = `common.levels.${lvl.toLowerCase()}`;
    const translated = (t as any)(key);
    return translated === key ? lvl : translated;
  };

  return (
    <WidgetCard
      title={t("coachAthleteState.widget.title")}
      tooltip={t("coachAthleteState.widget.tooltip")}
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
          {t("coachAthleteState.widget.missingData")}
        </div>
      ) : (
        <>
          <div className={WIDGET_KV_GRID}>
            <div className={WIDGET_KV_LABEL}>
              {" "}
              {t("coachAthleteState.widget.fatigue")}
            </div>
            <div className={WIDGET_KV_VALUE}>{getLvl(ui.fatigueLabel)}</div>

            <div className={WIDGET_KV_LABEL}>
              {" "}
              {t("coachAthleteState.widget.injuryRisk")}
            </div>
            <div className={WIDGET_KV_VALUE}>{getLvl(ui.injuryLabel)}</div>
          </div>

          <p className={WIDGET_SUMMARY_TEXT}>
            {ui.summary ? ui.summary : t("coachAthleteState.widget.summary")}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
