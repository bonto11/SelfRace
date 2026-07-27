// src/app/features/coach/components/DetailAthleteState.tsx
"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestAthleteState,
  apiAnalyzeAthleteState,
  type AthleteStateRecord,
} from "@/app/features/coach/api/coach_athlete_state";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle"; // 👈 IMPORT GLOBÁLNEHO TOGGLE
import { useSettings } from "@/app/shared/i18n/SettingsProvider"; // 👈 IMPORT SETTINGS PROVIDERA

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
  PANEL_GRID_3,
  PANEL_BAR_TRACK,
  PANEL_BAR_FILL,
  ACCORDION_FOOTER_BAR_MUTED,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens";

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

function getStatusColor(level?: string | null, inverseLogic = false): string | undefined {
  const l = (level || "").toLowerCase();
  if (l === "low") return inverseLogic ? appColors.statusSuccess : appColors.statusError;
  if (l === "moderate" || l === "medium") return appColors.statusWarning;
  if (l === "high") return inverseLogic ? appColors.statusError : appColors.statusSuccess;
  return undefined;
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
            <div className="flex flex-wrap justify-end gap-2">
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
  valueColor, 
}: {
  title: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
  valueColor?: string;
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
            <div 
              className={PANEL_SECTION_TITLE} 
              style={{ fontSize: "0.9rem", color: valueColor }}
            >
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
  // ⚠️ Over, či useUserId() naozaj vracia aj userUuid — apiAnalyzeAthleteState ho vyžaduje
  const { userId, userUuid } = useUserId() as any;
  const t = useT();
  const [row, setRow] = useState<AthleteStateRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🆕 Stav pre manuálnu analýzu
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  
  // 🛡️ Náš MASTER stav ťahaný z Providera
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  const loadState = useCallback(
    async (alive: { current: boolean } | null = null) => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestAthleteState(userId);
        if (!alive || alive.current) setRow(r ?? null);
      } catch (e: any) {
        if (!alive || alive.current)
          setError(t(e?.message as any) || t("coach.state.errorLoad" as any));
      } finally {
        if (!alive || alive.current) setLoading(false);
      }
    },
    [userId, t],
  );

  useEffect(() => {
    if (!userId) return;
    const alive = { current: true };
    loadState(alive);
    return () => {
      alive.current = false;
    };
  }, [userId, loadState]);

  const handleAnalyze = useCallback(async () => {
    if (!userId || !userUuid || analyzing) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await apiAnalyzeAthleteState(userId, userUuid);
      if (!res?.success) {
        setAnalyzeError(
          (res?.message && t(res.message as any)) ||
            t("coach.state.analyzeError" as any) ||
            "Analýza zlyhala.",
        );
        setAnalyzing(false);
        return;
      }
      // ✅ Podľa zadania: po úspešnej analýze zrefreshni celú obrazovku
      window.location.reload();
    } catch (e: any) {
      console.error("[Coach][DetailAthleteState] handleAnalyze ERROR", e);
      setAnalyzeError(
        t(e?.message as any) || t("coach.state.analyzeError" as any) || "Analýza zlyhala.",
      );
      setAnalyzing(false);
    }
  }, [userId, userUuid, analyzing, t]);

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

  const hasStrengthsOrLimits = (aiState.key_strengths && aiState.key_strengths.length > 0) || 
                               (aiState.key_limitations && aiState.key_limitations.length > 0);
                               
  const hasRisksOrTips = (userSummary.risks && userSummary.risks.length > 0) || 
                         (userSummary.suggestions_short && userSummary.suggestions_short.length > 0);

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
        <div className={[PANEL_PAD].join(" ")}>
          <AnalyzeButton
            analyzing={analyzing}
            onClick={handleAnalyze}
            t={t}
          />
          {analyzeError && (
            <div
              className={[PANEL_PREVIEW, "text-pretty mt-2"].join(" ")}
              style={{ color: appColors.statusError }}
            >
              {analyzeError}
            </div>
          )}
        </div>
      </Card>
    );

  return (
    <div className={PANEL_STACK}>
      
      <ShowAdvancedToggle />

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
        footer
      />

      {/* 🔐 POKROČILÁ SEKCIA (Ukáže sa len po zakliknutí Toggle) */}
      {showAdvanced && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          
          {/* Presunuté stavové ukazovatele (Únava, Zranenie, Fáza) - z veľkých tabletiek na grid */}
          <Card title={t("coach.progress.indicatorsTitle") || "Aktuálny stav organizmu"}>
            <div className={PANEL_GRID_3}>
              <Subcard
                title={t("coachAthleteState.lastAnalysis.fatigue" as any)}
                value={formatLevelLabel(aiState.fatigue_level, t)}
                valueColor={getStatusColor(aiState.fatigue_level, true)}
              />
              <Subcard
                title={t("coachAthleteState.lastAnalysis.injuryRisk" as any)}
                value={formatLevelLabel(aiState.injury_risk, t)}
                valueColor={getStatusColor(aiState.injury_risk, true)}
              />
              <Subcard
                title={t("coach.weekly.phase" as any)}
                value={aiState.suggested_block_kind ? t(`common.phases.${aiState.suggested_block_kind}` as any) : "—"}
                valueColor={appColors.statusInfo}
              />
            </div>
          </Card>

          {/* ÚROVEŇ PRIPRAVENOSTI */}
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

          {/* TOLERANCIA A ZÁŤAŽ */}
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
      {/* 🔐 KONIEC POKROČILEJ SEKCIE */}

      {/* 4. SILNÉ/SLABÉ STRÁNKY (Vždy viditeľné - ALE IBA AK NIE SÚ PRÁZDNE) */}
      {hasStrengthsOrLimits && (
        <Card title={t("coach.state.strengthsRisksTitle" as any)}>
          <div className="grid gap-3 md:grid-cols-2 min-w-0">
            {aiState.key_strengths && aiState.key_strengths.length > 0 && (
              <Subcard title={t("coach.state.strengths" as any)}>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {aiState.key_strengths.map((s: string, i: number) => (
                    <li key={i} className="text-pretty">{s}</li>
                  ))}
                </ul>
              </Subcard>
            )}
            
            {aiState.key_limitations && aiState.key_limitations.length > 0 && (
              <Subcard title={t("coach.state.limitations" as any)}>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {aiState.key_limitations.map((s: string, i: number) => (
                    <li key={i} className="text-pretty">{s}</li>
                  ))}
                </ul>
              </Subcard>
            )}
          </div>
        </Card>
      )}

      {/* 5. RIZIKÁ / TIPY (Vždy viditeľné - ALE IBA AK NIE SÚ PRÁZDNE) */}
      {hasRisksOrTips && (
        <Card title={t("coach.state.recsTitle" as any)}>
          <div className="grid gap-3 md:grid-cols-2 min-w-0">
            {userSummary.risks && userSummary.risks.length > 0 && (
              <Subcard title={t("coach.state.mainRisks" as any)}>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {userSummary.risks.map((r: string, i: number) => (
                    <li key={i} className="text-pretty">{r}</li>
                  ))}
                </ul>
              </Subcard>
            )}
            
            {userSummary.suggestions_short && userSummary.suggestions_short.length > 0 && (
              <Subcard title={t("coach.state.quickTips" as any)}>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {userSummary.suggestions_short.map((s: string, i: number) => (
                    <li key={i} className="text-pretty">{s}</li>
                  ))}
                </ul>
              </Subcard>
            )}
          </div>
        </Card>
      )}

      {/* 🆕 6. MANUÁLNA ANALÝZA (vždy na spodku) */}
      <Card footer={false}>
        <div className="flex flex-col items-center gap-2 py-1">
          <AnalyzeButton analyzing={analyzing} onClick={handleAnalyze} t={t} />
          {analyzeError && (
            <div
              className={[PANEL_PREVIEW, "text-pretty text-center"].join(" ")}
              style={{ color: appColors.statusError }}
            >
              {analyzeError}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}

/* ---------- analyze button ---------- */

function AnalyzeButton({
  analyzing,
  onClick,
  t,
}: {
  analyzing: boolean;
  onClick: () => void;
  t: any;
}) {
  const style: CSSProperties = {
    background: appColors.statusInfo,
    color: "#fff",
    opacity: analyzing ? 0.7 : 1,
    cursor: analyzing ? "not-allowed" : "pointer",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={analyzing}
      className="w-full max-w-xs rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
      style={style}
    >
      {analyzing ? (
        <>
          <LoadingSpinner size="button" />
          {t("coach.state.analyzing" as any) || "Analyzujem..."}
        </>
      ) : (
        t("coach.state.analyzeNow" as any) || "Analyzovať teraz"
      )}
    </button>
  );
}