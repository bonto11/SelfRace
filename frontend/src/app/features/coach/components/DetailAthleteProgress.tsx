"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/classes";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteProgress,
  type AthleteProgressRecord,
} from "@/app/features/coach/api/coach_athlete_state";

type ProgressParsed = {
  headline: string | null;
  generatedAt: string | null;
  summaryBullets: string[];
  positives: string[];
  negatives: string[];
  nextWeeksFocus: string[];
  riskFlags: string[];
};

function toStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  return [];
}

function parseProgress(row: AthleteProgressRecord | null): ProgressParsed {
  if (!row || !row.compare_previous) {
    return {
      headline: null,
      generatedAt: null,
      summaryBullets: [],
      positives: [],
      negatives: [],
      nextWeeksFocus: [],
      riskFlags: [],
    };
  }

  const cp: any = row.compare_previous;

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

  const nextWeeksFocus: string[] =
    toStringArray(cp.next_weeks_focus) ||
    toStringArray(cp.recommendations) ||
    toStringArray(cp.next_block_focus);

  const riskFlags: string[] =
    toStringArray(cp.risk_flags) || toStringArray(cp.alerts);

  let generatedAt: string | null = cp.generated_at || row.created_at || null;
  if (generatedAt) {
    try {
      const d = new Date(generatedAt);
      generatedAt = d.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      // nechaj raw
    }
  }

  return {
    headline,
    generatedAt,
    summaryBullets,
    positives,
    negatives,
    nextWeeksFocus,
    riskFlags,
  };
}

export default function DetailAthleteProgress() {
  const { userId } = useUserId();
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

  const parsed = useMemo(() => parseProgress(row), [row]);

  if (!userId) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Chýba userId (useUserId). Skontroluj prihlásenie používateľa.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-8 grid place-items-center">
          <LoadingSpinner size="widget" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm text-red-300">
          Nepodarilo sa načítať AI progress report.
          <div className="mt-1 text-xs opacity-75">{error}</div>
        </div>
      </div>
    );
  }

  if (!row || !row.compare_previous) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Zatiaľ nemáš žiadne uložené porovnanie AI analýz. Potrebujeme aspoň
          dve analýzy stavu (cron weekly refresh) – potom sa tu zobrazí
          prehľad progresu.
        </div>
      </div>
    );
  }

  const {
    headline,
    generatedAt,
    summaryBullets,
    positives,
    negatives,
    nextWeeksFocus,
    riskFlags,
  } = parsed;

  return (
    <div className="space-y-4 pb-6">
      {/* HLAVNÝ PREHĽAD */}
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Weekly progress – porovnanie posledných AI stavov
          </h2>
          {generatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Posledné porovnanie vytvorené: {generatedAt}
            </p>
          )}
          {headline && (
            <p className="mt-2 text-sm text-slate-100">{headline}</p>
          )}
          {summaryBullets.length > 0 && (
            <ul className="mt-3 text-sm space-y-1 list-disc list-inside text-slate-100">
              {summaryBullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-1.5 rounded-b-2xl bg-sky-500/80" />
      </section>

      {/* POZITÍVNE vs NEGATÍVNE TRENDS */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Trendy za posledné obdobie
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          {/* Pozitíva */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2 text-emerald-100">
                Čo ide správnym smerom
              </h4>
              {positives.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-emerald-100">
                  {positives.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  AI zatiaľ nevyzdvihla konkrétne zlepšenia.
                </p>
              )}
            </div>
          </div>

          {/* Výzvy */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2 text-amber-100">
                Kde si dávať väčší pozor
              </h4>
              {negatives.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-amber-100">
                  {negatives.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Zatiaľ bez výrazných negatívnych trendov.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* FOCUS NA ĎALŠIE TÝŽDNE + RISK FLAGS */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Fokus na najbližšie týždne
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">
                Čomu sa zamerať v tréningu
              </h4>
              {nextWeeksFocus.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-emerald-100">
                  {nextWeeksFocus.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Po ďalších porovnaniach sem AI doplní konkrétny fokus blokov.
                </p>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">Rizikové signály</h4>
              {riskFlags.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-rose-100">
                  {riskFlags.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Momentálne žiadne špecifické varovania z posledného
                  porovnania.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>
    </div>
  );
}