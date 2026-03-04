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

/* ---------- helper types ---------- */

// ✅ UPDATED TYPE: Capabilities namiesto fitness_level
type Capability = {
  level_1_to_5?: number | null;
  label?: string | null;
  comment?: string | null;
};

type AiState = {
  // Starý formát (fallback)
  fitness_level?: {
    run?: any;
    ride?: any;
    strength?: any;
  };
  // ✅ Nový formát
  capabilities?: {
    run?: Capability | null;
    ride?: Capability | null;
    strength?: Capability | null;
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

/* ---------- UI helpers ---------- */

function formatLevelLabel(level: string | null, t: any): string {
  const l = (level || "").toLowerCase();
  if (!l) return "—";
  if (l === "low") return t("coach.levels.low");
  if (l === "moderate" || l === "medium") return t("coach.levels.moderate");
  if (l === "high") return t("coach.levels.high");
  return l;
}

// ✅ 1-5 Scale normalization
function normalizeCapability(level?: number | null): number {
  const n = typeof level === "number" ? level : 0;
  return Math.max(0, Math.min(5, n));
}

// Fallback pre starý 1-10 systém
function normalizeLegacyLevel(level?: number | null): number {
    const n = typeof level === "number" ? level : 0;
    return Math.max(0, Math.min(10, n)) / 2; // Convert 10 -> 5 scale
}

function formatMinutesRange(min: number | null | undefined, max: number | null | undefined, t: any): string {
  if (!min && !max) return "—";
  const unit = t("common.units.hPerWeek");
  if (min && max) return `${Math.round(min / 60)}–${Math.round(max / 60)} ${unit}`;
  if (max) return `${t("coach.state.upTo")} ${Math.round(max / 60)} ${unit}`;
  return `${Math.round((min || 0) / 60)} ${unit}`;
}

function statusPillStyle(level?: string | null): CSSProperties {
  const l = (level || "").toLowerCase();
  if (!l) return { background: "rgba(0,0,0,0)", borderColor: appColors.surfaceCardBorder, color: appColors.textMuted };
  if (l === "low") return { background: "rgba(16,185,129,0.10)", borderColor: appColors.statusSuccess, color: appColors.statusSuccess };
  if (l === "moderate" || l === "medium") return { background: "rgba(245,158,11,0.10)", borderColor: appColors.statusWarning, color: appColors.statusWarning };
  if (l === "high") return { background: "rgba(239,68,68,0.10)", borderColor: appColors.statusError, color: appColors.statusError };
  return { background: "rgba(0,0,0,0)", borderColor: appColors.surfaceCardBorder, color: appColors.textMuted };
}

function blockPillStyle(): CSSProperties {
  return { background: "rgba(59,130,246,0.10)", borderColor: appColors.statusInfo, color: appColors.statusInfo };
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
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>}
          </div>
          {topRight && <div className={PANEL_STATUS_COL}>{topRight}</div>}
        </header>
      )}
      {children && <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>}
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
    <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className="flex justify-between items-baseline">
            <div className={PANEL_SECTION_SUBTITLE}>{title}</div>
            {value != null && <div className={PANEL_SECTION_TITLE} style={{fontSize: '0.9rem'}}>{value}</div>}
        </div>
        {children && <div className={PANEL_INNER_STACK}>{children}</div>}
      </div>
    </div>
  );
}

function Bar({
  value01, // 0 to 1
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
  const fillStyle = {
    success: { background: appColors.statusSuccess },
    info: { background: appColors.statusInfo },
    warning: { background: appColors.statusWarning },
    danger: { background: appColors.statusError },
  }[fillKind];

  return (
    <div className={PANEL_INNER_STACK}>
      {(labelLeft || labelRight) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 truncate text-gray-500">{labelLeft}</div>
          <div className="shrink-0">{labelRight}</div>
        </div>
      )}
      <div className={PANEL_BAR_TRACK} style={{ background: appColors.backgroundAlt }}>
        <div className={PANEL_BAR_FILL} style={{ width: `${pct}%`, ...fillStyle }} />
      </div>
    </div>
  );
}

/* ---------- hlavný komponent ---------- */

export default function DetailAthleteState() {
  const { userId } = useUserId();
  const t = useT();
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
        if (alive) setError(t(e?.message as any) || t("coach.state.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, t]);

  const parsed = useMemo(() => {
    if (!row || !row.state) return { userSummary: {} as UserSummary, aiState: {} as AiState, generatedAt: null };
    const s: any = row.state;
    const genAt = s.generated_at || row.created_at;
    let formattedDate = genAt;
    try {
      if (genAt) formattedDate = new Date(genAt).toLocaleString("sk-SK", {
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
      });
    } catch { /* fallback */ }
    return { userSummary: s.user_summary || {}, aiState: s.ai_state || {}, generatedAt: formattedDate };
  }, [row]);

  const { userSummary, aiState, generatedAt } = parsed;

  // ✅ Extrakcia Capabilities (1-5)
  // Fallback na starý fitness_level ak capabilities neexistuje
  let runLevel = 0;
  let runLabel = "";
  let runComment = "";
  
  if (aiState.capabilities?.run) {
      runLevel = normalizeCapability(aiState.capabilities.run.level_1_to_5);
      runLabel = aiState.capabilities.run.label || "";
      runComment = aiState.capabilities.run.comment || "";
  } else if (aiState.fitness_level?.run) {
      runLevel = normalizeLegacyLevel(aiState.fitness_level.run.level_1_to_10);
      runLabel = t("common.levels.form");
      runComment = aiState.fitness_level.run.comment || "";
  }

  let strengthLevel = 0;
  let strengthLabel = "";
  let strengthComment = "";

  if (aiState.capabilities?.strength) {
      strengthLevel = normalizeCapability(aiState.capabilities.strength.level_1_to_5);
      strengthLabel = aiState.capabilities.strength.label || "";
      strengthComment = aiState.capabilities.strength.comment || "";
  } else if (aiState.fitness_level?.strength) {
      strengthLevel = normalizeLegacyLevel(aiState.fitness_level.strength.level_1_to_10);
      strengthComment = aiState.fitness_level.strength.comment || "";
  }

  // ✅ VO2 Max
  const vo2max = aiState.metrics?.estimated_vo2max;

  const volumeRangeLabel = formatMinutesRange(aiState.volume_tolerance?.weekly_minutes_min, aiState.volume_tolerance?.weekly_minutes_max, t);
  const acute = aiState.metrics?.acute_load_score ?? null;
  const chronic = aiState.metrics?.chronic_load_score ?? null;

  /* ---------- states ---------- */

  if (!userId) {
    return <Card title={t("coachAthleteState.title")} subtitle={t("common.errors.missingUserAuth")}><div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div></Card>;
  }
  if (loading) {
    return <section className={PANEL_SURFACE} style={PANEL_SURFACE_STYLE}><div className={[PANEL_PAD, "grid place-items-center"].join(" ")}><LoadingSpinner size="widget" /></div></section>;
  }
  if (error || !row || !row.state) {
    return <Card title={t("coachAthleteState.title")} subtitle={t("coach.state.noDataTitle")}><div className={PANEL_PREVIEW}>{error ?? t("coach.state.noDataDesc")}</div></Card>;
  }

  /* ---------- UI ---------- */

  const statusPills = (
    <>
      <div className={PANEL_STATUS_PILL} style={statusPillStyle(aiState.fatigue_level)}>
        {t("coachAthleteState.lastAnalysis.fatigue")}: {formatLevelLabel(aiState.fatigue_level, t)}
      </div>
      <div className={PANEL_STATUS_PILL} style={statusPillStyle(aiState.injury_risk)}>
        {t("coachAthleteState.lastAnalysis.injuryRisk")}: {formatLevelLabel(aiState.injury_risk, t)}
      </div>
      {aiState.suggested_block_kind && (
        <div className={PANEL_STATUS_PILL} style={blockPillStyle()}>
          {t("coach.weekly.phase")}: {aiState.suggested_block_kind}
        </div>
      )}
    </>
  );

  return (
    <div className={PANEL_STACK}>
      <Card
        title={t("coach.state.mainTitle")}
        subtitle={[
          generatedAt ? `${t("coach.state.lastAnalysis")}: ${generatedAt}` : null,
          userSummary.headline,
        ].filter(Boolean).join(" · ")}
        topRight={statusPills}
        footer
      />

      <Card title={t("coach.state.capabilitiesTitle") || "Schopnosti & Fitness"} subtitle={t("coach.state.capabilitiesSubtitle") || "Odhadovaná úroveň na základe histórie"}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          
          {/* ✅ Run Capability */}
          <Subcard title={t("common.sports.run")} value={runLabel || `${runLevel}/5`}>
            {/* Bar scale 0 to 1 based on 5 levels */}
            <Bar 
                value01={runLevel / 5} 
                fillKind="success" 
                labelLeft={runComment}
                labelRight={`${runLevel}/5`}
            />
          </Subcard>

          {/* ✅ Strength Capability */}
          <Subcard title={t("common.sports.strength")} value={strengthLabel || `${strengthLevel}/5`}>
            <Bar 
                value01={strengthLevel / 5} 
                fillKind="info" 
                labelLeft={strengthComment}
                labelRight={`${strengthLevel}/5`}
            />
          </Subcard>

          {/* ✅ VO2 Max Card */}
          {vo2max && (
             <Subcard title="VO₂ Max (Est.)" value={vo2max}>
                <div className="text-sm text-gray-500 mt-1">
                   {t("coach.state.vo2maxDesc") || "Odhadovaná hodnota na základe biometrie a výkonu."}
                </div>
                {/* Visual bar relative to scale approx 20-80 */}
                <div className="mt-2">
                     <Bar value01={(vo2max - 20) / 60} fillKind="warning" labelLeft="Aerobic Capacity" />
                </div>
             </Subcard>
          )}

        </div>
      </Card>

      <Card title={t("coach.state.toleranceTitle")} subtitle={t("coach.state.toleranceSubtitle")}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title={t("coach.state.weeklyVolume")} value={volumeRangeLabel}>
            <Bar value01={0.7} fillKind="info" labelLeft={aiState.volume_tolerance?.note} />
          </Subcard>
          <Subcard
            title={t("coach.state.hardSessions")}
            value={aiState.intensity_tolerance?.hard_sessions_per_week_max != null ? `1–${aiState.intensity_tolerance.hard_sessions_per_week_max}` : "—"}
          >
            <Bar value01={0.5} fillKind="warning" labelLeft={aiState.intensity_tolerance?.comment} />
          </Subcard>
        </div>

        {(acute != null || chronic != null) && (
          <div className={[SESSION_SUBCARD, "mt-3 min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
            <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
              <div className={PANEL_SECTION_TITLE}>{t("coach.state.loadTitle")}</div>
              <div className="grid gap-3 md:grid-cols-2 min-w-0">
                <Bar value01={Math.min(1, (chronic ?? 0) / 400)} fillKind="success" labelLeft={t("coach.state.chronicLoad")} labelRight={chronic ?? "—"} />
                <Bar value01={Math.min(1, (acute ?? 0) / 400)} fillKind="danger" labelLeft={t("coach.state.acuteLoad")} labelRight={acute ?? "—"} />
              </div>
              <div className={PANEL_PREVIEW}>{t("coach.state.loadDesc")}</div>
            </div>
          </div>
        )}
      </Card>

      <Card title={t("coach.state.strengthsRisksTitle")}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title={t("coach.state.strengths")}>
            {aiState.key_strengths?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {aiState.key_strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            ) : <div className={PANEL_PREVIEW}>{t("coach.state.noDataShort")}</div>}
          </Subcard>
          <Subcard title={t("coach.state.limitations")}>
            {aiState.key_limitations?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {aiState.key_limitations.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            ) : <div className={PANEL_PREVIEW}>{t("coach.state.noDataShort")}</div>}
          </Subcard>
        </div>
      </Card>

      <Card title={t("coach.state.recsTitle")}>
        <div className="grid gap-3 md:grid-cols-2 min-w-0">
          <Subcard title={t("coach.state.mainRisks")}>
            {userSummary.risks?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {userSummary.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            ) : <div className={PANEL_PREVIEW}>{t("coach.state.noRisksDesc")}</div>}
          </Subcard>
          <Subcard title={t("coach.state.quickTips")}>
            {userSummary.suggestions_short?.length ? (
              <ul className="list-disc list-inside text-sm space-y-1">
                {userSummary.suggestions_short.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ul>
            ) : <div className={PANEL_PREVIEW}>{t("coach.state.noTipsDesc")}</div>}
          </Subcard>
        </div>
      </Card>
    </div>
  );
}