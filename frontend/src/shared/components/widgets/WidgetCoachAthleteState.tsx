"use client";

import { useEffect, useMemo, useState } from "react";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";
import { apiGetLatestAthleteState, type AthleteStateRecord } from "@/features/coach/api/coach_athlete_state";

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

  // 2) fatigue / injury – snažíme sa chytiť rozumné polia, všetko optional
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

export default function WidgetCoachAIAnalyze({ onOpenDetail }: Props) {
  const { user } = useCoachData() as any;

  // tu si podľa svojho provideru uprav, ak máš userId inde
  const userId: number | null =
    user?.id ?? user?.user_id ?? null;

  const [row, setRow] = useState<AthleteStateRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiGetLatestAthleteState(userId);
        if (!cancelled) {
          setRow(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Nastala chyba pri načítaní AI analýzy.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const ui = useMemo(() => extractUiState(row), [row]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            AI analýza atleta
          </div>
          <div className="text-base font-semibold text-slate-50">
            Stav &amp; fatigue overview
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
          AI
        </span>
      </div>

      {/* obsah */}
      {isLoading ? (
        <div className="mt-3 space-y-2 text-sm animate-pulse">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/10" />
        </div>
      ) : error ? (
        <div className="mt-3 text-sm text-red-300">
          Nepodarilo sa načítať AI analýzu atleta.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="mt-3 text-sm text-slate-300">
          Chýba userId v CoachDataProvider – skontroluj, čo doň posielaš.
        </div>
      ) : !row ? (
        <div className="mt-3 text-sm text-slate-300">
          Zatiaľ nemáš žiadnu uloženú AI analýzu. Spusť ju v coach sekcii a
          widget sa automaticky naplní.
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Posledná analýza</span>
              <span className="font-semibold text-slate-50">
                {ui.lastAnalysisAt ?? "—"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Fatigue</span>
              <span className="font-semibold text-slate-50">
                {ui.fatigueLabel ?? "—"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Injury risk</span>
              <span className="font-semibold text-slate-50">
                {ui.injuryLabel ?? "—"}
              </span>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {ui.summary
              ? ui.summary
              : "Tu bude krátke zhrnutie AI analýzy (fitnes, únava, riziká)."}
          </p>
        </>
      )}

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 hover:bg-slate-900"
        >
          Otvoriť detail analýzy
        </button>
      )}
    </div>
  );
}