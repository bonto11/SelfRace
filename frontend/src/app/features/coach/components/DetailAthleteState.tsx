"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";

import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  // PANELS (layout + panel surface style)
  PANEL_SURFACE,
  PANEL_SURFACE_STYLE,
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_STATUS_COL,
  PANEL_STATUS_PILL,
  PANEL_BAR_TRACK,
  PANEL_BAR_FILL,
  ACCORDION_FOOTER_BAR_MUTED,

  // SESSION (subcard surface + style)
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
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

/* ---------- styles (NO tailwind colors) ---------- */

type PillStyle = CSSProperties;

function statusPillStyle(level?: string | null): PillStyle {
  const l = (level || "").toLowerCase();

  // neutral / unknown
  if (!l) {
    return {
      background: "rgba(0,0,0,0)",
      borderColor: appColors.surfaceCardBorder,
      color: appColors.textMuted,
    };
  }

  // use appColors.* (NOT tailwind classes)
  if (l === "low") {
    return {
      background: "rgba(16,185,129,0.10)",
      borderColor: appColors.statusSuccess,
      color: appColors.statusSuccess,
    };
  }
  if (l === "moderate" || l === "medium") {
    return {
      background: "rgba(245,158,11,0.10)",
      borderColor: appColors.statusWarning,
      color: appColors.statusWarning,
    };
  }
  if (l === "high") {
    return {
      background: "rgba(239,68,68,0.10)",
      borderColor: appColors.statusError,
      color: appColors.statusError,
    };
  }

  return {
    background: "rgba(0,0,0,0)",
    borderColor: appColors.surfaceCardBorder,
    color: appColors.textMuted,
  };
}

function blockPillStyle(): PillStyle {
  return {
    background: "rgba(59,130,246,0.10)",
    borderColor: appColors.statusInfo,
    color: appColors.statusInfo,
  };
}

const BAR_TRACK_STYLE: CSSProperties = {
  background: appColors.backgroundAlt,
};

function barFillStyle(kind: "success" | "info" | "warning" | "danger"): CSSProperties {
  if (kind === "success") return { background: appColors.statusSuccess };
  if (kind === "info") return { background: appColors.statusInfo };
  if (kind === "warning") return { background: appColors.statusWarning };
  return { background: appColors.statusError };
}

/* ---------- tiny building blocks (token-first) ---------- */

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
  children?: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}>
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

      {children ? (
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
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
    <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_SECTION_SUBTITLE}>{title}</div>
        {value != null ? <div className={PANEL_SECTION_TITLE}>{value}</div> : null}
        {children ? <div className={PANEL_INNER_STACK}>{children}</div> : null}
      </div>
    </div>
  );
}

function Bar({
  value01, // 0..1
  labelLeft,
  labelRight,
  fillKind,
}: {
  value01: number;
  labelLeft?: React.ReactNode;
  labelRight?: React.ReactNode;
  fillKind: "success" | "info" | "warning" | "danger";
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

      <div className={PANEL_BAR_TRACK} style={BAR_TRACK_STYLE}>
        <div
          className={PANEL_BAR_FILL}
          style={{ width: `${pct}%`, ...barFillStyle(fillKind) }}
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
      <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}>
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
      <div className={PANEL_STATUS_PILL} style={statusPillStyle(aiState.fatigue_level)}>
        Fatigue: {formatLevelLabel(aiState.fatigue_level)}
      </div>

      <div className={PANEL_STATUS_PILL} style={statusPillStyle(aiState.injury_risk)}>
        Injury: {formatLevelLabel(aiState.injury_risk)}
      </div>

      {aiState.suggested_block_kind ? (
        <div className={PANEL_STATUS_PILL} style={blockPillStyle()}>
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
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title="Beh" value={runLevel ? `${runLevel}/10` : "—"}>
            <Bar
              value01={runLevel / 10}
              fillKind="success"
              labelLeft={aiState.fitness_level?.run?.comment ?? null}
            />
          </Subcard>

          <Subcard title="Sila" value={strengthLevel ? `${strengthLevel}/10` : "—"}>
            <Bar
              value01={strengthLevel / 10}
              fillKind="info"
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
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title="Týždenný objem" value={volumeRangeLabel}>
            <Bar
              value01={0.7}
              fillKind="info"
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
              fillKind="warning"
              labelLeft={aiState.intensity_tolerance?.comment ?? null}
            />
          </Subcard>
        </div>

        {acute != null || chronic != null ? (
          <div className={[SESSION_SUBCARD, "mt-3 min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Tréningová záťaž</div>

              <div className="grid gap-3 md:grid-cols-2 min-w-0">
                <Bar
                  value01={Math.min(1, (chronic ?? 0) / 400)}
                  fillKind="success"
                  labelLeft="Chronic load"
                  labelRight={chronic != null ? chronic : "—"}
                />
                <Bar
                  value01={Math.min(1, (acute ?? 0) / 400)}
                  fillKind="danger"
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
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
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

          <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
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
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
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

          <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>Rýchle tipy na ďalšie týždne</div>
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