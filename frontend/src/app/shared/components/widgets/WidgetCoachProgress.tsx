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
  headline: string | null;
  bullets: string[];
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
      headline: null,
      bullets: [],
    };
  }

  const cp = payload;
  const headline: string | null = cp.summary?.headline || cp.headline || null;
  const bullets: string[] = toStringArray(cp.summary?.bullets) || toStringArray(cp.summary_bullets);

  return {
    hasData: true,
    headline,
    bullets,
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

  return (
    <WidgetCard
      title={t("coachProgress.widget.title")}
      tooltip={t("coachProgress.widget.tooltip")}
      accent="none"
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
                  {/* 👈 Tu som odstránil 'truncate' a pridal 'text-pretty' pre pekné zalamovanie */}
                  <span className="text-pretty">{b}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </WidgetCard>
  );
}
