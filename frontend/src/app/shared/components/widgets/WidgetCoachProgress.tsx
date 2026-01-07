"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { THEME } from "@/app/shared/theme/tokens";
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
  summaryBullets: string[];
  positives: string[];
  negatives: string[];
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string");
  }
  return [];
}

function buildUiState(progress: AthleteProgressRecord | null): UiState {
  if (!progress || !progress.compare_previous) {
    return {
      hasData: false,
      comparedAt: null,
      headline: null,
      summaryBullets: [],
      positives: [],
      negatives: [],
    };
  }

  const cp: any = progress.compare_previous;

  // headline – viacero možných názvov pre robustnosť
  const headline: string | null =
    cp.headline ||
    cp.summary?.headline ||
    cp.user_summary?.headline ||
    null;

  const summaryBullets: string[] =
    toStringArray(cp.summary_bullets) ||
    toStringArray(cp.summary?.bullets) ||
    toStringArray(cp.user_summary?.bullets);

  const positives: string[] =
    toStringArray(cp.positives) ||
    toStringArray(cp.positive_trends) ||
    toStringArray(cp.improvements);

  const negatives: string[] =
    toStringArray(cp.negatives) ||
    toStringArray(cp.negative_trends) ||
    toStringArray(cp.regressions);

  // dátum – preferuj generated_at, fallback created_at z riadku
  let comparedAt: string | null = cp.generated_at || progress.created_at || null;
  if (comparedAt) {
    try {
      const d = new Date(comparedAt);
      comparedAt = d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      // nechaj raw string
    }
  }

  return {
    hasData: true,
    comparedAt,
    headline,
    summaryBullets,
    positives,
    negatives,
  };
}

export default function WidgetCoachProgress({ onOpenDetail }: Props) {
  const { userId } = useUserId();

  const [progress, setProgress] = useState<AthleteProgressRecord | null>(null);
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
        if (alive) setProgress(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(
            e?.message ?? "Chyba pri načítaní AI progress reportu."
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const ui = useMemo(() => buildUiState(progress), [progress]);

  const accent =
    THEME?.chart?.neutral ??
    THEME?.chart?.lineSecondary ??
    THEME?.chart?.run ??
    "#3B82F6";

  return (
    <WidgetCard
      title="Coach — Weekly progress"
      note={
        ui.hasData
          ? ui.comparedAt
            ? `Posledné porovnanie: ${ui.comparedAt}`
            : "Posledné porovnanie AI stavov atleta."
          : "Potrebujeme aspoň 2 AI analýzy stavu (cron/maintenance ich urobí 1× týždenne)."
      }
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-300">
          Nepodarilo sa načítať progress report.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : !userId ? (
        <div className="text-sm opacity-80">
          Chýba userId (useUserId). Skontroluj autentifikáciu.
        </div>
      ) : !ui.hasData ? (
        <div className="text-sm opacity-80">
          Zatiaľ nemáš uložené žiadne AI porovnanie stavov. Po dvoch
          analyzovaných týždňoch sa tu zobrazí prehľad progresu.
        </div>
      ) : (
        <>
          {ui.headline && (
            <div className="text-sm font-medium mb-2">{ui.headline}</div>
          )}

          {ui.summaryBullets.length > 0 && (
            <ul className="text-xs space-y-1 mb-2">
              {ui.summaryBullets.slice(0, 3).map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                Zlepšenia
              </div>
              {ui.positives.length ? (
                <ul className="space-y-1 text-emerald-100">
                  {ui.positives.slice(0, 3).map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="truncate">{p}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="opacity-60">Zatiaľ bez zvýraznených plusov.</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1">
                Výzvy / mínusy
              </div>
              {ui.negatives.length ? (
                <ul className="space-y-1 text-amber-100">
                  {ui.negatives.slice(0, 3).map((n, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="truncate">{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="opacity-60">Bez zásadných varovaní.</div>
              )}
            </div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}