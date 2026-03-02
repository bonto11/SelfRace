// src/shared/components/widgets/WidgetCoachAthleteState.tsx
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
  WIDGET_TRUNCATE,
} from "@/app/shared/ui/tokens";

import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";

import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { parseAndFormatPrettyDate } from "@/app/shared/utils/time";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  lastAnalysisAt: string | null;
  fatigueLabel: string | null;
  injuryLabel: string | null;
  summary: string | null;
};

// 👇 ZMENA: Pridali sme parameter lang 👇
function extractUiState(row: AthleteStateRecord | null, lang: string): UiState {
  if (!row || !row.state) {
    return {
      lastAnalysisAt: null,
      fatigueLabel: null,
      injuryLabel: null,
      summary: null,
    };
  }

  const s: any = row.state;

  const generatedAt: string | undefined = s.generated_at;
  const createdAt: string | undefined = row.created_at;

  let lastAnalysisAt: string | null = null;
  const iso = generatedAt || createdAt;
  
  if (iso) {
    // 👇 ZMENA: Použitie novej funkcie s jazykom 👇
    lastAnalysisAt = parseAndFormatPrettyDate(iso, lang);
  }

  const fatigueLabel: string | null =
    s?.ai_state?.fatigue?.label ??
    s?.ai_state?.fatigue_level ??
    s?.fatigue?.label ??
    s?.fatigue_level ??
    null;

  const injuryLabel: string | null =
    s?.ai_state?.injury_risk?.label ??
    s?.ai_state?.injury_risk_level ??
    s?.injury_risk?.label ??
    s?.injury_risk_level ??
    null;

  const summary: string | null =
    s?.user_summary?.headline ??
    s?.user_summary?.short ??
    s?.user_summary?.text ??
    null;

  return { lastAnalysisAt, fatigueLabel, injuryLabel, summary };
}

function pickAccent(ui: UiState) {
  const fat = (ui.fatigueLabel || "").toLowerCase();
  const inj = (ui.injuryLabel || "").toLowerCase();

  const hasHigh =
    fat.includes("high") ||
    fat.includes("vysok") ||
    inj.includes("high") ||
    inj.includes("vysok");

  const hasMod =
    fat.includes("moder") ||
    fat.includes("stred") ||
    inj.includes("moder") ||
    inj.includes("stred");

  if (hasHigh) return appColors.stateDanger;
  if (hasMod) return appColors.stateWarning;
  return "none";
}

export default function WidgetCoachAthleteState({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [row, setRow] = useState<AthleteStateRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const t = useT();
  // 👇 ZMENA: Vytiahneme lang 👇
  const { lang } = useSettings();

  useEffect(() => {
    if (!userId) return;

    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestAthleteState(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? t("coachAthleteState.widget.errorFailedLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

  // 👇 ZMENA: Posielame lang do funkcie 👇
  const ui = useMemo(() => extractUiState(row, lang), [row, lang]);
  
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
      note={ui.lastAnalysisAt ? "" : t("coachAthleteState.widget.note")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {/* ... (loading/error stavy) ... */}
      {loading ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>
          {t("widget.missingserId")} {/* Ponechal som tvoje preklepy :) */}
        </div>
      ) : !row ? (
        <div className={WIDGET_EMPTY_TEXT}>
          {t("coachAthleteState.widget.missingData")}
        </div>
      ) : (
        <>
          <div className={WIDGET_KV_GRID}>
            <div className={WIDGET_KV_LABEL}> {t("coachAthleteState.widget.lastAnalysis")}</div>
            <div className={[WIDGET_KV_VALUE, WIDGET_TRUNCATE].join(" ")}>
              {ui.lastAnalysisAt ?? "—"}
            </div>

            <div className={WIDGET_KV_LABEL}> {t("coachAthleteState.widget.fatigue")}</div>
            <div className={WIDGET_KV_VALUE}>{getLvl(ui.fatigueLabel)}</div>

            <div className={WIDGET_KV_LABEL}> {t("coachAthleteState.widget.injuryRisk")}</div>
            <div className={WIDGET_KV_VALUE}>{getLvl(ui.injuryLabel)}</div>
          </div>

          <p className={WIDGET_SUMMARY_TEXT}>
            {ui.summary
              ? ui.summary
              : t("coachAthleteState.widget.summary")}
          </p>
        </>
      )}
    </WidgetCard>
  );
}