// src/features/coach/components/DetailAthleteState.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/shared/ui/classes";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/features/coach/api/coach_athlete_state";

/* ---------- helper typy ---------- */

type AiState = {
  fitness_level?: {
    run?: { level_1_to_10?: number | null; comment?: string | null } | null;
    ride?: { level_1_to_10?: number | null; comment?: string | null } | null;
    strength?: { level_1_to_10?: number | null; comment?: string | null } | null;
  };
  fatigue_level?: string | null;
  injury_risk?: string | null;
  volume_tolerance?: {
    weekly_minutes_min?: number | null;
    weekly_minutes_max?: number | null;
    note?: string | null;
  } | null;
  intensity_tolerance?: {
    hard_sessions_per_week_max?: number | null;
    comment?: string | null;
  } | null;
  suggested_block_kind?: string | null;
  key_limitations?: string[] | null;
  key_strengths?: string[] | null;
  metrics?: {
    estimated_vo2max?: number | null;
    estimated_5k_time_min?: number | null;
    chronic_load_score?: number | null;
    acute_load_score?: number | null;
  } | null;
};

type UserSummary = {
  headline?: string | null;
  bullets?: string[] | null;
  risks?: string[] | null;
  suggestions_short?: string[] | null;
};

/* ---------- malé UI helpery ---------- */

function formatLevelLabel(level?: string | null): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return "nízka";
  if (l === "moderate" || l === "medium") return "stredná";
  if (l === "high") return "vysoká";
  return l;
}

function pillClass(level?: string | null, kind: "fatigue" | "injury" = "fatigue") {
  const l = (level || "").toLowerCase();
  if (!l) return "bg-slate-800 text-slate-100 border border-slate-600";

  if (kind === "fatigue") {
    if (l === "low") return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/70";
    if (l === "moderate" || l === "medium")
      return "bg-amber-900/60 text-amber-100 border border-amber-500/70";
    if (l === "high") return "bg-rose-900/60 text-rose-100 border border-rose-500/70";
  } else {
    if (l === "low") return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/70";
    if (l === "moderate" || l === "medium")
      return "bg-amber-900/60 text-amber-100 border border-amber-500/70";
    if (l === "high") return "bg-rose-900/60 text-rose-100 border border-rose-500/70";
  }

  return "bg-slate-800 text-slate-100 border border-slate-600";
}

function normalizeLevel(level?: number | null): number {
  const n = typeof level === "number" ? level : 0;
  if (n < 0) return 0;
  if (n > 10) return 10;
  return n;
}

function formatMinutesRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "—";
  if (min && max) return `${Math.round(min / 60)}–${Math.round(max / 60)} h / týždeň`;
  if (max) return `do ${Math.round(max / 60)} h / týždeň`;
  return `${Math.round((min || 0) / 60)} h / týždeň`;
}

/* ---------- hlavný komponent ---------- */

export default function DetailAthleteState() {
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

  const parsed = useMemo(() => {
    if (!row || !row.state) {
      return {
        userSummary: {} as UserSummary,
        aiState: {} as AiState,
        generatedAt: null as string | null,
      };
    }

    const s: any = row.state;
    const userSummary: UserSummary = s.user_summary || {};
    const aiState: AiState = s.ai_state || {};
    const generatedAtIso: string | undefined = s.generated_at || row.created_at;

    let generatedAt: string | null = null;
    if (generatedAtIso) {
      try {
        const d = new Date(generatedAtIso);
        generatedAt = d.toLocaleString(undefined, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        generatedAt = generatedAtIso;
      }
    }

    return { userSummary, aiState, generatedAt };
  }, [row]);

  const { userSummary, aiState, generatedAt } = parsed;

  const runLevel = normalizeLevel(aiState.fitness_level?.run?.level_1_to_10);
  const strengthLevel = normalizeLevel(
    aiState.fitness_level?.strength?.level_1_to_10
  );

  const volumeRangeLabel = formatMinutesRange(
    aiState.volume_tolerance?.weekly_minutes_min ?? null,
    aiState.volume_tolerance?.weekly_minutes_max ?? null
  );

  const acute = aiState.metrics?.acute_load_score ?? null;
  const chronic = aiState.metrics?.chronic_load_score ?? null;

  /* ---------- UI ---------- */

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
          Nepodarilo sa načítať AI analýzu atleta.
          <div className="mt-1 text-xs opacity-75">{error}</div>
        </div>
      </div>
    );
  }

  if (!row || !row.state) {
    return (
      <div className={SURFACE_CARD}>
        <div className="px-4 py-4 text-sm">
          Zatiaľ nemáš žiadnu uloženú AI analýzu. Spusť AI analýzu v coach
          sekcii a tu uvidíš detailný prehľad.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* HLAVNÝ PREHĽAD */}
      <section className={SURFACE_CARD}>
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Stav atleta – detailná AI analýza
            </h2>
            {generatedAt && (
              <p className="text-xs text-slate-400 mt-1">
                Posledná AI analýza: {generatedAt}
              </p>
            )}
            {userSummary.headline && (
              <p className="mt-2 text-sm text-slate-100">
                {userSummary.headline}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
            <div
              className={[
                "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide",
                pillClass(aiState.fatigue_level, "fatigue"),
              ].join(" ")}
            >
              Fatigue: {formatLevelLabel(aiState.fatigue_level)}
            </div>
            <div
              className={[
                "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide",
                pillClass(aiState.injury_risk, "injury"),
              ].join(" ")}
            >
              Injury risk: {formatLevelLabel(aiState.injury_risk)}
            </div>
            {aiState.suggested_block_kind && (
              <div className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-sky-900/60 text-sky-100 border border-sky-500/70">
                Blok: {aiState.suggested_block_kind}
              </div>
            )}
          </div>
        </div>

        {/* spodná lišta */}
        <div className="h-1.5 rounded-b-2xl bg-emerald-500/80" />
      </section>

      {/* FITNESS LEVEL – MINI GRAFY */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Fitness úroveň (1–10)
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Jednoduchá stupnica 1–10: 5 = priemer, 8+ = veľmi dobrá úroveň.
          </p>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          {/* RUN */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Beh</span>
                <span className="text-sm font-semibold">
                  {runLevel ? `${runLevel}/10` : "—"}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${(runLevel / 10) * 100}%` }}
                />
              </div>
              {aiState.fitness_level?.run?.comment && (
                <p className="mt-2 text-xs text-slate-300">
                  {aiState.fitness_level.run.comment}
                </p>
              )}
            </div>
          </div>

          {/* STRENGTH */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Sila</span>
                <span className="text-sm font-semibold">
                  {strengthLevel ? `${strengthLevel}/10` : "—"}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${(strengthLevel / 10) * 100}%` }}
                />
              </div>
              {aiState.fitness_level?.strength?.comment && (
                <p className="mt-2 text-xs text-slate-300">
                  {aiState.fitness_level.strength.comment}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* spodná lišta */}
        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* TOLERANCIA OBJEMU A INTENZITY */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Koľko tréningu zvládneš
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Bezpečné rozpätie tréningového objemu a odporúčaný počet ťažkých
            tréningov.
          </p>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          {/* OBJEM */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Týždenný objem</span>
                <span className="text-sm font-semibold">
                  {volumeRangeLabel}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: "70%" }}
                />
              </div>
              {aiState.volume_tolerance?.note && (
                <p className="text-xs text-slate-300">
                  {aiState.volume_tolerance.note}
                </p>
              )}
            </div>
          </div>

          {/* INTENZITA */}
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Ťažké tréningy / týždeň
                </span>
                <span className="text-sm font-semibold">
                  {aiState.intensity_tolerance?.hard_sessions_per_week_max !=
                  null
                    ? `1–${aiState.intensity_tolerance.hard_sessions_per_week_max}`
                    : "—"}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: "50%" }}
                />
              </div>
              {aiState.intensity_tolerance?.comment && (
                <p className="text-xs text-slate-300">
                  {aiState.intensity_tolerance.comment}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ACUTE vs CHRONIC load mini graf */}
        {(acute != null || chronic != null) && (
          <div className="px-4 pb-4">
            <div className={SURFACE_SUBCARD}>
              <div className="px-3 pt-3 pb-3">
                <h4 className="text-sm font-medium mb-2">
                  Tréningová záťaž (posledné obdobie)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300">Chronic load</span>
                      <span className="font-semibold">
                        {chronic != null ? chronic : "—"}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((chronic ?? 0) / 400) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300">Acute load</span>
                      <span className="font-semibold">
                        {acute != null ? acute : "—"}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{
                          width: `${Math.min(
                            100,
                            ((acute ?? 0) / 400) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Chronic = dlhodobejší priemer záťaže, Acute = posledné
                  obdobie. Ak je A výrazne nad C, rastie riziko únavy a zranení.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* SILNÉ STRÁNKY & LIMITÁCIE */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Silné stránky a limitácie
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">Silné stránky</h4>
              {aiState.key_strengths?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-emerald-100">
                  {aiState.key_strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Zatiaľ bez záznamu.</p>
              )}
            </div>
          </div>
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">Limitácie / riziká</h4>
              {aiState.key_limitations?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-amber-100">
                  {aiState.key_limitations.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">Zatiaľ bez záznamu.</p>
              )}
            </div>
          </div>
        </div>

        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* RISKS + SUGGESTIONS z user_summary */}
      <section className={SURFACE_CARD}>
        <header className="px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold tracking-tight">
            Odporúčania pre tréning
          </h3>
        </header>

        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">Hlavné riziká</h4>
              {userSummary.risks?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-amber-100">
                  {userSummary.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  AI pri poslednej analýze nezvýraznila konkrétne riziká.
                </p>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className="px-3 pt-3 pb-3">
              <h4 className="text-sm font-semibold mb-2">
                Rýchle tipy na ďalšie týždne
              </h4>
              {userSummary.suggestions_short?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1 text-emerald-100">
                  {userSummary.suggestions_short.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400">
                  Po ďalšej analýze sa tu zobrazia konkrétne odporúčania.
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