"use client";

import { useEffect, useMemo, useState } from "react";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/tokens";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_GRID_3,
  PANEL_PREVIEW,
  PANEL_STATUS_COL,
  PANEL_STATUS_PILL,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

/* ---------- helper typy ---------- */

type AiState = {
  fitness_level?: {
    run?: { level_1_to_10?: number | null; comment?: string | null } | null;
    ride?: { level_1_to_10?: number | null; comment?: string | null } | null;
    strength?: {
      level_1_to_10?: number | null;
      comment?: string | null;
    } | null;
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

// NOTE: colors are still hardcoded here; layout is token-first.
// When you add tokens for status variants, swap them in here only.
function pillClass(
  level?: string | null,
  kind: "fatigue" | "injury" = "fatigue"
) {
  const l = (level || "").toLowerCase();
  if (!l) return "bg-slate-800 text-slate-100 border border-slate-600";

  if (kind === "fatigue") {
    if (l === "low")
      return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/70";
    if (l === "moderate" || l === "medium")
      return "bg-amber-900/60 text-amber-100 border border-amber-500/70";
    if (l === "high")
      return "bg-rose-900/60 text-rose-100 border border-rose-500/70";
  } else {
    if (l === "low")
      return "bg-emerald-900/60 text-emerald-100 border border-emerald-500/70";
    if (l === "moderate" || l === "medium")
      return "bg-amber-900/60 text-amber-100 border border-amber-500/70";
    if (l === "high")
      return "bg-rose-900/60 text-rose-100 border border-rose-500/70";
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
  if (min && max)
    return `${Math.round(min / 60)}–${Math.round(max / 60)} h / týždeň`;
  if (max) return `do ${Math.round(max / 60)} h / týždeň`;
  return `${Math.round((min || 0) / 60)} h / týždeň`;
}

/* ---------- tiny building blocks ---------- */

function Card({
  title,
  subtitle,
  topRight,
  children,
  footer = true,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  topRight?: React.ReactNode;
  children?: React.ReactNode; // ✅ optional
  footer?: boolean;
}) {
  return (
    <section className={SURFACE_CARD}>
      {(title || subtitle || topRight) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
          {topRight ? <div className={PANEL_STATUS_COL}>{topRight}</div> : null}
        </header>
      )}

      {/* ✅ render body len keď existuje */}
      {children ? (
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          {children}
        </div>
      ) : null}

      {footer ? <div className={ACCORDION_FOOTER_BAR_MUTED} /> : null}
    </section>
  );
}

function Subcard({
  title,
  value,
  children,
}: {
  title: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={SURFACE_SUBCARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_SECTION_SUBTITLE}>{title}</div>
        {value != null ? (
          <div className={PANEL_SECTION_TITLE}>{value}</div>
        ) : null}
        {children ? <div className={PANEL_INNER_STACK}>{children}</div> : null}
      </div>
    </div>
  );
}

function Bar({
  value01, // 0..1
  labelLeft,
  labelRight,
  fillClassName,
}: {
  value01: number;
  labelLeft?: React.ReactNode;
  labelRight?: React.ReactNode;
  fillClassName: string;
}) {
  const pct = Math.max(0, Math.min(1, value01)) * 100;

  return (
    <div className={PANEL_INNER_STACK}>
      {(labelLeft || labelRight) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate">{labelLeft}</div>
          <div className="shrink-0">{labelRight}</div>
        </div>
      )}

      <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={["h-full rounded-full", fillClassName].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
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

  /* ---------- states ---------- */

  if (!userId) {
    return (
      <Card title="Athlete state" subtitle="Chýba userId (useUserId).">
        <div className={PANEL_PREVIEW}>Skontroluj prihlásenie používateľa.</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <Card title="Athlete state" subtitle="Nepodarilo sa načítať AI analýzu.">
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  if (!row || !row.state) {
    return (
      <Card title="Athlete state" subtitle="Zatiaľ nemáš uloženú AI analýzu.">
        <div className={PANEL_PREVIEW}>
          Spusť <strong>Analyze Athlete state</strong> vo widgete{" "}
          <strong>Coach — Plan</strong> a po uložení sa tu zobrazí detail.
        </div>
      </Card>
    );
  }

  /* ---------- UI ---------- */

  const statusPills = (
    <>
      <div
        className={[
          PANEL_STATUS_PILL,
          pillClass(aiState.fatigue_level, "fatigue"),
        ].join(" ")}
      >
        Fatigue: {formatLevelLabel(aiState.fatigue_level)}
      </div>

      <div
        className={[
          PANEL_STATUS_PILL,
          pillClass(aiState.injury_risk, "injury"),
        ].join(" ")}
      >
        Injury: {formatLevelLabel(aiState.injury_risk)}
      </div>

      {aiState.suggested_block_kind ? (
        <div
          className={[
            PANEL_STATUS_PILL,
            "bg-sky-900/60 text-sky-100 border border-sky-500/70",
          ].join(" ")}
        >
          Blok: {aiState.suggested_block_kind}
        </div>
      ) : null}
    </>
  );

  return (
    <div className={PANEL_STACK}>
      <Card
        title="Stav atleta – detailná AI analýza"
        subtitle={[
          generatedAt ? `Posledná AI analýza: ${generatedAt}` : null,
          userSummary.headline ? userSummary.headline : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        topRight={statusPills}
        footer
      />

      <Card
        title="Fitness úroveň (1–10)"
        subtitle="Jednoduchá stupnica: 5 = priemer, 8+ = veľmi dobrá úroveň."
        footer
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Subcard title="Beh" value={runLevel ? `${runLevel}/10` : "—"}>
            <Bar
              value01={runLevel / 10}
              fillClassName="bg-emerald-500"
              labelLeft={aiState.fitness_level?.run?.comment ?? null}
            />
          </Subcard>

          <Subcard
            title="Sila"
            value={strengthLevel ? `${strengthLevel}/10` : "—"}
          >
            <Bar
              value01={strengthLevel / 10}
              fillClassName="bg-violet-500"
              labelLeft={aiState.fitness_level?.strength?.comment ?? null}
            />
          </Subcard>
        </div>
      </Card>

      <Card
        title="Koľko tréningu zvládneš"
        subtitle="Bezpečné rozpätie objemu a odporúčaný počet ťažkých tréningov."
        footer
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Subcard title="Týždenný objem" value={volumeRangeLabel}>
            <Bar
              value01={0.7}
              fillClassName="bg-sky-500"
              labelLeft={aiState.volume_tolerance?.note ?? null}
            />
          </Subcard>

          <Subcard
            title="Ťažké tréningy / týždeň"
            value={
              aiState.intensity_tolerance?.hard_sessions_per_week_max != null
                ? `1–${aiState.intensity_tolerance.hard_sessions_per_week_max}`
                : "—"
            }
          >
            <Bar
              value01={0.5}
              fillClassName="bg-amber-500"
              labelLeft={aiState.intensity_tolerance?.comment ?? null}
            />
          </Subcard>
        </div>

        {acute != null || chronic != null ? (
          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Tréningová záťaž</div>

              <div className="grid gap-3 md:grid-cols-2">
                <Bar
                  value01={Math.min(1, (chronic ?? 0) / 400)}
                  fillClassName="bg-emerald-500"
                  labelLeft="Chronic load"
                  labelRight={chronic != null ? chronic : "—"}
                />
                <Bar
                  value01={Math.min(1, (acute ?? 0) / 400)}
                  fillClassName="bg-rose-500"
                  labelLeft="Acute load"
                  labelRight={acute != null ? acute : "—"}
                />
              </div>

              <div className={PANEL_PREVIEW}>
                Chronic = dlhodobejší priemer záťaže, Acute = posledné obdobie.
                Ak je A výrazne nad C, rastie riziko únavy a zranení.
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <Card title="Silné stránky a limitácie" footer>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Silné stránky</div>
              {aiState.key_strengths?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {aiState.key_strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>Zatiaľ bez záznamu.</div>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Limitácie / riziká</div>
              {aiState.key_limitations?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {aiState.key_limitations.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>Zatiaľ bez záznamu.</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Odporúčania pre tréning" footer>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Hlavné riziká</div>
              {userSummary.risks?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {userSummary.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>
                  AI pri poslednej analýze nezvýraznila konkrétne riziká.
                </div>
              )}
            </div>
          </div>

          <div className={SURFACE_SUBCARD}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>
                Rýchle tipy na ďalšie týždne
              </div>
              {userSummary.suggestions_short?.length ? (
                <ul className="list-disc list-inside text-sm space-y-1">
                  {userSummary.suggestions_short.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className={PANEL_PREVIEW}>
                  Po ďalšej analýze sa tu zobrazia konkrétne odporúčania.
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
