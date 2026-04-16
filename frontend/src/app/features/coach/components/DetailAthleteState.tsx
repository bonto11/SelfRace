// src/app/features/coach/components/DetailAthleteState.tsx
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
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
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens";

/* ---------- KONŠTANTY FARIEB ---------- */

const UNIFORM_PILL_BASE: CSSProperties = {
  width: "160px",
  height: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  lineHeight: "1.1",
  fontSize: "0.7rem",
  fontWeight: 600,
  padding: "4px 8px",
  textTransform: "uppercase",
};

/* ---------- helper types ---------- */

type Capability = {
  level_1_to_5?: number | null;
  label?: string | null;
  comment?: string | null;
};

type AiState = {
  capabilities?: {
    run?: Capability | null;
    ride?: Capability | null;
    strength?: Capability | null;
  };
  fitness_level?: {
    run?: any;
    ride?: any;
    strength?: any;
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
    acute_load_score?: number | null;
    chronic_load_score?: number | null;
  } | null;
};

type UserSummary = {
  headline?: string | null;
  risks?: string[] | null;
  suggestions_short?: string[] | null;
};

/* ---------- UI helpers ---------- */

function formatLevelLabel(level: string | null, t: any): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return t("coach.levels.low" as any);
  if (l === "moderate" || l === "medium")
    return t("coach.levels.moderate" as any);
  if (l === "high") return t("coach.levels.high" as any);
  return l;
}

function normalizeCapability(level?: number | null): number {
  const n = typeof level === "number" ? level : 0;
  return Math.max(0, Math.min(5, n));
}

function normalizeLegacyLevel(level?: number | null): number {
  const n = typeof level === "number" ? level : 0;
  return Math.max(0, Math.min(10, n)) / 2;
}

function formatMinutesRange(
  min: number | null | undefined,
  max: number | null | undefined,
  t: any,
): string {
  if (!min && !max) return "—";
  const unit = t("common.units.hPerWeek" as any);
  if (min && max)
    return `${Math.round(min / 60)}–${Math.round(max / 60)} ${unit}`;
  if (max)
    return `${t("coach.state.upTo" as any)} ${Math.round(max / 60)} ${unit}`;
  return `${Math.round((min || 0) / 60)} ${unit}`;
}

function statusPillStyle(level?: string | null): CSSProperties {
  const l = (level || "").toLowerCase();
  let colors: CSSProperties = {
    background: "rgba(0,0,0,0)",
    borderColor: appColors.surfaceCardBorder,
    color: appColors.textMuted,
  };

  if (l === "low")
    colors = {
      background: "rgba(16,185,129,0.10)",
      borderColor: appColors.statusSuccess,
      color: appColors.statusSuccess,
    };
  if (l === "moderate" || l === "medium")
    colors = {
      background: "rgba(245,158,11,0.10)",
      borderColor: appColors.statusWarning,
      color: appColors.statusWarning,
    };
  if (l === "high")
    colors = {
      background: "rgba(239,68,68,0.10)",
      borderColor: appColors.statusError,
      color: appColors.statusError,
    };

  return { ...UNIFORM_PILL_BASE, ...colors };
}

function blockPillStyle(): CSSProperties {
  return {
    ...UNIFORM_PILL_BASE,
    background: "rgba(59,130,246,0.10)",
    borderColor: appColors.statusInfo,
    color: appColors.statusInfo,
  };
}

/* ---------- building blocks ---------- */

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
          <div className="min-w-0 flex-1">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && (
              <div
                className={[PANEL_SECTION_SUBTITLE, "text-pretty"].join(" ")}
              >
                {subtitle}
              </div>
            )}
          </div>
          {topRight && (
            <div
              className={[
                PANEL_STATUS_COL,
                "flex flex-wrap justify-end gap-2",
              ].join(" ")}
            >
              {topRight}
            </div>
          )}
        </header>
      )}
      {children && (
        <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
          {children}
        </div>
      )}
      {footer && <div className={ACCORDION_FOOTER_BAR_MUTED} />}
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
    <div
      className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")}
      style={SESSION_SUBCARD_STYLE}
    >
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className="flex flex-wrap justify-between items-baseline gap-2">
          <div
            className={[PANEL_SECTION_SUBTITLE, "whitespace-nowrap"].join(" ")}
          >
            {title}
          </div>
          {value != null && (
            <div className={PANEL_SECTION_TITLE} style={{ fontSize: "0.9rem" }}>
              {value}
            </div>
          )}
        </div>
        {children && <div className={PANEL_INNER_STACK}>{children}</div>}
      </div>
    </div>
  );
}

function Bar({
  value01,
  labelLeft,
  labelRight,
  fillColor,
}: {
  value01: number;
  labelLeft?: React.ReactNode;
  labelRight?: React.ReactNode;
  fillColor: string;
}) {
  const pct = Math.max(0, Math.min(1, value01)) * 100;
  
  return (
    <div className={PANEL_INNER_STACK}>
      {(labelLeft || labelRight) && (
        <div className="flex items-start justify-between gap-2 text-xs">
          <div className="min-w-0 text-gray-500 text-pretty leading-snug">
            {labelLeft}
          </div>
          <div className="shrink-0 font-bold">{labelRight}</div>
        </div>
      )}
      <div
        className={PANEL_BAR_TRACK}
        style={{ background: appColors.backgroundAlt }}
      >
        <div
          className={PANEL_BAR_FILL}
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}

/* ---------- main ---------- */

export default function DetailAthleteState() {
  const { userId } = useUserId();
  const t = useT();
  const [row, setRow] = useState<AthleteStateRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🛡️ Náš MASTER stav pre Progressive Disclosure (defaultne Simple režim)
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        if (alive)
          setError(t(e?.message as any) || t("coach.state.errorLoad" as any));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, t]);

  const parsed = useMemo(() => {
    if (!row || !row.state)
      return {
        userSummary: {} as UserSummary,
        aiState: {} as AiState,
        generatedAt: null,
      };
    const s: any = row.state;
    const root = s.ai_state ? s : s.analysis || s;

    const genAt = s.generated_at || row.created_at;
    let formattedDate = genAt;
    try {
      if (genAt)
        formattedDate = new Date(genAt).toLocaleString("sk-SK", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
    } catch {
      /* fallback */
    }

    return {
      userSummary: root.user_summary || {},
      aiState: root.ai_state || {},
      generatedAt: formattedDate,
    };
  }, [row]);

  const { userSummary, aiState, generatedAt } = parsed;

  const runInfo = useMemo(() => {
    if (!aiState.capabilities?.run && !aiState.fitness_level?.run) return null;
    if (aiState.capabilities?.run)
      return {
        level: normalizeCapability(aiState.capabilities.run.level_1_to_5),
        label: aiState.capabilities.run.label || "",
        comment: aiState.capabilities.run.comment || "",
      };
    return {
      level: normalizeLegacyLevel(aiState.fitness_level?.run.level_1_to_10),
      label: t("common.levels.form" as any),
      comment: aiState.fitness_level?.run.comment || "",
    };
  }, [aiState, t]);

  const strengthInfo = useMemo(() => {
    if (!aiState.capabilities?.strength && !aiState.fitness_level?.strength)
      return null;
    if (aiState.capabilities?.strength)
      return {
        level: normalizeCapability(aiState.capabilities.strength.level_1_to_5),
        label: aiState.capabilities.strength.label || "",
        comment: aiState.capabilities.strength.comment || "",
      };
    return {
      level: normalizeLegacyLevel(
        aiState.fitness_level?.strength.level_1_to_10,
      ),
      label: "",
      comment: aiState.fitness_level?.strength.comment || "",
    };
  }, [aiState]);

  const vo2max = aiState.metrics?.estimated_vo2max;
  const volumeRangeLabel = formatMinutesRange(
    aiState.volume_tolerance?.weekly_minutes_min,
    aiState.volume_tolerance?.weekly_minutes_max,
    t,
  );
  const acute = aiState.metrics?.acute_load_score ?? null;
  const chronic = aiState.metrics?.chronic_load_score ?? null;

  if (!userId)
    return (
      <Card
        title={t("coachAthleteState.title" as any)}
        subtitle={t("common.errors.missingUserAuth" as any)}
      >
        <div className={PANEL_PREVIEW}>
          {t("common.errors.checkLogin" as any)}
        </div>
      </Card>
    );
  if (loading)
    return (
      <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );
  if (error || !row || !row.state)
    return (
      <Card
        title={t("coachAthleteState.title" as any)}
        subtitle={t("coach.state.noDataTitle" as any)}
      >
        <div className={PANEL_PREVIEW}>
          {error ?? t("coach.state.noDataDesc" as any)}
        </div>
      </Card>
    );

  const statusPills = (
    <>
      <div
        className={PANEL_STATUS_PILL}
        style={statusPillStyle(aiState.fatigue_level)}
      >
        {t("coachAthleteState.lastAnalysis.fatigue" as any)}:{" "}
        {formatLevelLabel(aiState.fatigue_level, t)}
      </div>
      <div
        className={PANEL_STATUS_PILL}
        style={statusPillStyle(aiState.injury_risk)}
      >
        {t("coachAthleteState.lastAnalysis.injuryRisk" as any)}:{" "}
        {formatLevelLabel(aiState.injury_risk, t)}
      </div>
      {aiState.suggested_block_kind && (
        <div className={PANEL_STATUS_PILL} style={blockPillStyle()}>
          {t("coach.weekly.phase" as any)}: {t(`common.phases.${aiState.suggested_block_kind}` as any)}
        </div>
      )}
    </>
  );

  return (
    <div className={PANEL_STACK}>
      
      {/* 1. HLAVNÝ SÚHRN (Vždy viditeľné) */}
      <Card
        title={t("coach.state.mainTitle" as any)}
        subtitle={[
          generatedAt
            ? `${t("coach.state.lastAnalysis" as any)}: ${generatedAt}`
            : null,
          userSummary.headline,
        ]
          .filter(Boolean)
          .join(" · ")}
        topRight={statusPills}
        footer
      />

      {/* 🌟 MASTER TOGGLE PRE POKROČILÝ REŽIM (Čistý dizajn, bez podnadpisu) 🌟 */}
      <div
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all border select-none mb-1 shadow-sm"
        style={{
          backgroundColor: showAdvanced ? "rgba(59, 130, 246, 0.08)" : "rgba(255, 255, 255, 0.02)",
          borderColor: showAdvanced ? "rgba(59, 130, 246, 0.15)" : "rgba(255, 255, 255, 0.05)",
        }}
      >
        <div className="text-sm font-semibold text-white/90">
          {t("coach.state.advancedToggle")}
        </div>
        <div
          className={`relative inline-flex items-center h-[22px] rounded-full w-10 transition-colors ${
            showAdvanced ? "bg-blue-500" : "bg-white/10"
          }`}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${
              showAdvanced ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </div>
      </div>

      {/* 🔐 2. ÚROVEŇ PRIPRAVENOSTI (Iba Advanced) */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <Card
            title={t("coach.state.capabilitiesTitle" as any)}
            subtitle={t("coach.state.capabilitiesSubtitle" as any)}
          >
            <div className="grid gap-3 md:grid-cols-2 min-w-0">
              {runInfo && (
                <Subcard
                  title={t("common.sports.run" as any)}
                  value={runInfo.label || `${runInfo.level}/5`}
                >
                  <Bar
                    value01={runInfo.level / 5}
                    fillColor={appColors.chartRun}
                    labelLeft={runInfo.comment}
                    labelRight={`${runInfo.level}/5`}
                  />
                </Subcard>
              )}

              {strengthInfo && (
                <Subcard
                  title={t("common.sports.strength" as any)}
                  value={strengthInfo.label || `${strengthInfo.level}/5`}
                >
                  <Bar
                    value01={strengthInfo.level / 5}
                    fillColor={appColors.chartStrength}
                    labelLeft={strengthInfo.comment}
                    labelRight={`${strengthInfo.level}/5`}
                  />
                </Subcard>
              )}

              {vo2max && (
                <Subcard title="VO₂ Max (Est.)" value={vo2max}>
                  <div className="text-sm text-gray-500 mt-1 text-pretty">
                    {t("coach.state.vo2maxDesc")}
                  </div>
                  <div className="mt-2">
                    <Bar
                      value01={(vo2max - 20) / 60}
                      fillColor={appColors.chartLine3}
                    />
                  </div>
                </Subcard>
              )}

              {!runInfo && !strengthInfo && !vo2max && (
                <div className={PANEL_PREVIEW}>
                  {t("coach.state.noCapabilities" as any)}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 🔐 3. TOLERANCIA A ZÁŤAŽ (Iba Advanced) */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <Card
            title={t("coach.state.toleranceTitle" as any)}
            subtitle={t("coach.state.toleranceSubtitle" as any)}
          >
            <div className="grid gap-3 md:grid-cols-2 min-w-0">
              <Subcard
                title={t("coach.state.weeklyVolume" as any)}
                value={volumeRangeLabel}
              >
                <Bar
                  value01={0.7}
                  fillColor={appColors.chartLine1}
                  labelLeft={aiState.volume_tolerance?.note}
                />
              </Subcard>
              <Subcard
                title={t("coach.state.hardSessions" as any)}
                value={
                  aiState.intensity_tolerance?.hard_sessions_per_week_max != null
                    ? `1–${aiState.intensity_tolerance.hard_sessions_per_week_max}`
                    : "—"
                }
              >
                <Bar
                  value01={0.5}
                  fillColor={appColors.chartLine2}
                  labelLeft={aiState.intensity_tolerance?.comment}
                />
              </Subcard>
            </div>

            {(acute != null || chronic != null) && (
              <div
                className={[SESSION_SUBCARD, "mt-3 min-w-0 w-full"].join(" ")}
                style={SESSION_SUBCARD_STYLE}
              >
                <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                  <div className={PANEL_SECTION_TITLE}>
                    {t("coach.state.loadTitle" as any)}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 min-w-0">
                    <Bar
                      value01={Math.min(1, (chronic ?? 0) / 400)}
                      fillColor={appColors.statusSuccess}
                      labelLeft={t("coach.state.chronicLoad" as any)}
                      labelRight={chronic ?? "—"}
                    />
                    <Bar
                      value01={Math.min(1, (acute ?? 0) / 400)}
                      fillColor={appColors.statusError}
                      labelLeft={t("coach.state.acuteLoad" as any)}
                      labelRight={acute ?? "—"}
                    />
                  </div>
                  <div className={[PANEL_PREVIEW, "text-pretty"].join(" ")}>
                    {t("coach.state.loadDesc" as any)}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 4. SILNÉ/SLABÉ STRÁNKY (Vždy viditeľné) */}
      <Card title={t("coach.state.strengthsRisksTitle" as any)}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title={t("coach.state.strengths" as any)}>
            {aiState.key_strengths?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {aiState.key_strengths.map((s: string, i: number) => (
                  <li key={i} className="text-pretty">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={PANEL_PREVIEW}>
                {t("coach.state.noDataShort" as any)}
              </div>
            )}
          </Subcard>
          <Subcard title={t("coach.state.limitations" as any)}>
            {aiState.key_limitations?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {aiState.key_limitations.map((s: string, i: number) => (
                  <li key={i} className="text-pretty">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={PANEL_PREVIEW}>
                {t("coach.state.noDataShort" as any)}
              </div>
            )}
          </Subcard>
        </div>
      </Card>

      {/* 5. RIZIKÁ / TIPY (Vždy viditeľné) */}
      <Card title={t("coach.state.recsTitle" as any)}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title={t("coach.state.mainRisks" as any)}>
            {userSummary.risks?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {userSummary.risks.map((r: string, i: number) => (
                  <li key={i} className="text-pretty">
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={PANEL_PREVIEW}>
                {t("coach.state.noRisksDesc" as any)}
              </div>
            )}
          </Subcard>
          <Subcard title={t("coach.state.quickTips" as any)}>
            {userSummary.suggestions_short?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {userSummary.suggestions_short.map((s: string, i: number) => (
                  <li key={i} className="text-pretty">
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <div className={PANEL_PREVIEW}>
                {t("coach.state.noTipsDesc" as any)}
              </div>
            )}
          </Subcard>
        </div>
      </Card>
    </div>
  );
}