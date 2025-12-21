// src/shared/components/widgets/WidgetCoachAthleteState.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { THEME } from "@/app/shared/theme/tokens";
import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/features/coach/api/coach_athlete_state";

type Props = {
  onOpenDetail?: () => void;
};

type UiState = {
  lastAnalysisAt: string | null;
  fatigueLabel: string | null;
  injuryLabel: string | null;
  summary: string | null;
};

function extractUiState(row: AthleteStateRecord | null): UiState {
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
    try {
      const d = new Date(iso);
      lastAnalysisAt = d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      lastAnalysisAt = iso;
    }
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

  return {
    lastAnalysisAt,
    fatigueLabel,
    injuryLabel,
    summary,
  };
}

export default function WidgetCoachAthleteState({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [row, setRow] = useState<AthleteStateRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (alive) setError(e?.message ?? "Chyba pri načítaní AI analýzy.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => extractUiState(row), [row]);

  const accent =
    THEME?.chart?.athletes ??
    THEME?.chart?.run ??
    THEME?.chart?.neutral ??
    "#22C55E";

  return (
    <WidgetCard
      title="Coach — Athlete state"
      note={ui.lastAnalysisAt ? "" : "Spusť AI analýzu trénovanosti."}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">
          Nepodarilo sa načítať AI analýzu.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="text-sm opacity-80">
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !row ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš žiadnu uloženú AI analýzu. Spusť ju v coach sekcii a
          widget sa automaticky naplní.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <div className="opacity-75">Posledná analýza</div>
            <div className="font-semibold truncate">
              {ui.lastAnalysisAt ?? "—"}
            </div>

            <div className="opacity-75">Fatigue</div>
            <div className="font-semibold">{ui.fatigueLabel ?? "—"}</div>

            <div className="opacity-75">Injury risk</div>
            <div className="font-semibold">{ui.injuryLabel ?? "—"}</div>
          </div>

          <p className="mt-3 text-xs opacity-80">
            {ui.summary
              ? ui.summary
              : "Krátke AI zhrnutie únavy, formy a rizík sa zobrazí po najbližšej analýze."}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
