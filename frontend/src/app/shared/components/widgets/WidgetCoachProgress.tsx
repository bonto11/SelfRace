// src/shared/components/widgets/WidgetCoachProgress.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  WIDGET_CENTER_SPINNER,
  WIDGET_ERROR_BLOCK,
  WIDGET_ERROR_SUB,
  WIDGET_EMPTY_TEXT,
  WIDGET_HEADLINE,
  WIDGET_BULLET_LIST,
  WIDGET_BULLET_ROW,
  WIDGET_BULLET_DOT,
  WIDGET_INFO_GRID_XS,
  WIDGET_LABEL_MUTED_XS,
  WIDGET_VALUE_STRONG_XS,
} from "@/app/shared/ui/tokens";

import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  hasData: boolean;
  comparedAt: string | null;
  headline: string | null;
  bullets: string[];
  fatigueData: { previous: string | null; current: string | null };
  injuryData: { previous: string | null; current: string | null };
  blockLabel: string | null;
  volumeData: { from: number; to: number } | null;
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

function buildUiState(row: AthleteProgressRecord | null): UiState {
  const payload: any = (row as any)?.report ?? (row as any)?.compare_previous ?? null;

  if (!row || !payload) {
    return {
      hasData: false,
      comparedAt: null,
      headline: null,
      bullets: [],
      fatigueData: { previous: null, current: null },
      injuryData: { previous: null, current: null },
      blockLabel: null,
      volumeData: null,
    };
  }

  const cp = payload;
  const headline: string | null = cp.summary?.headline || cp.headline || null;
  const bullets: string[] = toStringArray(cp.summary?.bullets) || toStringArray(cp.summary_bullets);

  const comp = cp.comparisons || {};
  const vol = comp.volume_tolerance || {};

  let volumeData = null;
  if (typeof vol.previous_weekly_minutes_min === "number" && typeof vol.current_weekly_minutes_min === "number") {
    volumeData = {
      from: Math.round(vol.previous_weekly_minutes_min / 60),
      to: Math.round(vol.current_weekly_minutes_min / 60),
    };
  }

  let comparedAt: string | null = cp.generated_at || (row as any).created_at || null;
  if (comparedAt) {
    try {
      const d = new Date(comparedAt);
      comparedAt = d.toLocaleString("sk-SK", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch { /* keep raw */ }
  }

  return {
    hasData: true,
    comparedAt,
    headline,
    bullets,
    fatigueData: { previous: comp.fatigue_level?.previous, current: comp.fatigue_level?.current },
    injuryData: { previous: comp.injury_risk?.previous, current: comp.injury_risk?.current },
    blockLabel: comp.block_kind?.previous || comp.block_kind?.current 
      ? `${comp.block_kind.previous || "—"} → ${comp.block_kind.current || "—"}` 
      : null,
    volumeData,
  };
}

export default function WidgetCoachProgress({ onOpenDetail }: Props) {
  const { userId } = useUserId();
  const t = useT();

  const [row, setRow] = useState<AthleteProgressRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestAthleteProgress(userId);
        if (alive) setRow(r ?? null);
      } catch (e: any) {
        if (alive) setError(e?.message ?? t("coachProgress.widget.errorFetch"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, t]);

  const ui = useMemo(() => buildUiState(row), [row]);

  // Pomocná funkcia na preklad úrovní (low/high...)
  const getLvl = (lvl?: string | null) => {
    if (!lvl) return "—";
    const key = `common.levels.${lvl.toLowerCase()}`;
    const translated = (t as any)(key);
    return translated === key ? lvl : translated;
  };

  const fatigueLabel = ui.fatigueData.previous || ui.fatigueData.current
    ? `${getLvl(ui.fatigueData.previous)} → ${getLvl(ui.fatigueData.current)}`
    : "—";

  const injuryLabel = ui.injuryData.previous || ui.injuryData.current
    ? `${getLvl(ui.injuryData.previous)} → ${getLvl(ui.injuryData.current)}`
    : "—";

  const volumeLabel = ui.volumeData
    ? t("coachProgress.labels.volumeValue")
        .replace("{{from}}", String(ui.volumeData.from))
        .replace("{{to}}", String(ui.volumeData.to))
    : "—";

  const note = useMemo(() => {
    if (!ui.hasData) return t("coachProgress.widget.noteMissing");
    if (!ui.comparedAt) return t("coachProgress.widget.noteLastCompareGeneric");
    return t("coachProgress.widget.noteLastCompare").replace("{{date}}", ui.comparedAt);
  }, [ui, t]);

  return (
    <WidgetCard
      title={t("coachProgress.widget.title")}
      tooltip={t("coachProgress.widget.tooltip")}
      accent="none"
      note={note}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className={WIDGET_CENTER_SPINNER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_BLOCK}>
          {t("coachProgress.widget.errorTitle")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_EMPTY_TEXT}>
          {t("widget.missingUserId")}
        </div>
      ) : !ui.hasData ? (
        <div className={WIDGET_EMPTY_TEXT}>
          {t("coachProgress.widget.empty")}
        </div>
      ) : (
        <>
          {ui.headline && <div className={WIDGET_HEADLINE}>{ui.headline}</div>}

          {ui.bullets.length > 0 && (
            <ul className={WIDGET_BULLET_LIST}>
              {ui.bullets.slice(0, 3).map((b, i) => (
                <li key={i} className={WIDGET_BULLET_ROW}>
                  <span className={WIDGET_BULLET_DOT} />
                  <span className="truncate">{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={WIDGET_INFO_GRID_XS}>
            <div className={WIDGET_LABEL_MUTED_XS}>{t("coachAthleteState.lastAnalysis.fatigue")}</div>
            <div className={WIDGET_VALUE_STRONG_XS}>{fatigueLabel}</div>

            <div className={WIDGET_LABEL_MUTED_XS}>{t("coachAthleteState.lastAnalysis.injuryRisk")}</div>
            <div className={WIDGET_VALUE_STRONG_XS}>{injuryLabel}</div>

            <div className={WIDGET_LABEL_MUTED_XS}>{t("coach.weekly.phase")}</div>
            <div className={WIDGET_VALUE_STRONG_XS}>{ui.blockLabel ?? "—"}</div>

            <div className={WIDGET_LABEL_MUTED_XS}>{t("coachProgress.labels.volume")}</div>
            <div className={WIDGET_VALUE_STRONG_XS}>{volumeLabel}</div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}