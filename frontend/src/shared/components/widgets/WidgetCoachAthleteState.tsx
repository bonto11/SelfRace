"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { THEME } from "@/shared/theme/tokens";
import { fetchLatestAthleteState, AthleteStateRow } from "@/shared/api/coachAthleteState";

type Props = {
  userId: number;
  onOpenDetail?: () => void;
};

type UiState = {
  lastAnalysisAt: string | null;
  fatigueLabel: string | null;
  injuryLabel: string | null;
  summary: string | null;
};

function extractUiState(row: AthleteStateRow | null): UiState {
  if (!row || !row.state) {
    return {
      lastAnalysisAt: null,
      fatigueLabel: null,
      injuryLabel: null,
      summary: null,
    };
  }

  const s = row.state as any;

  // 1) dátum – preferuj generated_at z AI, inak created_at z DB
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

  // 2) fatigue – snažíme sa chytiť niektoré rozumné polia, ale všetko je optional
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

  // 3) krátke summary – headline / short / text
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

export default function WidgetCoachAthleteState({ userId, onOpenDetail }: Props) {
  const [row, setRow] = useState<AthleteStateRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchLatestAthleteState(userId);
        if (!cancelled) {
          setRow(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Nastala chyba pri načítaní analýzy.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (userId != null) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ui = useMemo(() => extractUiState(row), [row]);

  const accentHex = THEME.chart.athletes ?? THEME.chart.neutral;

  return (
    <WidgetCard
      title="Coach — Athlete state"
      note={
        ui.lastAnalysisAt
          ? `Posledná AI analýza: ${ui.lastAnalysisAt}`
          : "Zatiaľ žiadna uložená AI analýza."
      }
      accent={accentHex}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={180}
    >
      {isLoading ? (
        <div className="animate-pulse space-y-2 text-sm">
          <div className="h-4 rounded bg-white/5" />
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="h-3 w-full rounded bg-white/5" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">
          Nepodarilo sa načítať AI analýzu atleta.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !row ? (
        <div className="text-sm text-slate-300">
          Pre tohto atleta ešte nemáš žiadnu uloženú AI analýzu. Spusť ju cez
          „Analyze athlete“ a widget sa automaticky naplní.
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="opacity-75">Posledná analýza</div>
            <div className="font-semibold">
              {ui.lastAnalysisAt ?? "—"}
            </div>

            <div className="opacity-75">Fatigue</div>
            <div className="font-semibold">
              {ui.fatigueLabel ?? "—"}
            </div>

            <div className="opacity-75">Injury risk</div>
            <div className="font-semibold">
              {ui.injuryLabel ?? "—"}
            </div>
          </div>

          {ui.summary && (
            <p className="text-xs leading-snug text-slate-300">
              {ui.summary}
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}