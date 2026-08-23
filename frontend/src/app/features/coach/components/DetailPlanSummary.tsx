// src/app/features/coach/components/DetailPlanSummary.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestPlanSummary,
  apiGenerateMilestoneSummary,
  type PlanSummaryRecord,
  type SportStatsRow,
  type UnmatchedActivitySport,
} from "@/app/features/coach/api/coach_plan_active";
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
  ACCORDION_FOOTER_BAR_MUTED,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
} from "@/app/shared/ui/tokens";

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
              <div className={[PANEL_SECTION_SUBTITLE, "text-pretty"].join(" ")}>
                {subtitle}
              </div>
            )}
          </div>
          {topRight && (
            <div className="flex flex-wrap justify-end gap-2">{topRight}</div>
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
    <div className={[SESSION_SUBCARD, "min-w-0 w-full"].join(" ")} style={SESSION_SUBCARD_STYLE}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className="flex flex-wrap justify-between items-baseline gap-2">
          <div className={[PANEL_SECTION_SUBTITLE, "whitespace-nowrap"].join(" ")}>
            {title}
          </div>
          {value != null && (
            <div className={PANEL_SECTION_TITLE} style={{ fontSize: "0.9rem", color: valueColor }}>
              {value}
            </div>
          )}
        </div>
        {children && <div className={PANEL_INNER_STACK}>{children}</div>}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("sk-SK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTimeS(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPaceSPerKm(s: number | null | undefined): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")} /km`;
}

function formatMinutes(min: number | null | undefined): string {
  if (!min || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(min)} min`;
}

function achievedColor(achieved: boolean | null | undefined): string | undefined {
  if (achieved === true) return appColors.statusSuccess;
  if (achieved === false) return appColors.stateWarning;
  return undefined;
}

const SPORT_LABEL: Record<string, string> = {
  run: "Beh",
  ride: "Bicykel",
  swim: "Plávanie",
  strength: "Posilňovanie",
  other: "Iné",
};

/* ---------- sport stats table (znovupoužiteľná pre plan/combined/unmatched) ---------- */

function SportStatsTable({
  rows,
}: {
  rows: (SportStatsRow | UnmatchedActivitySport)[] | null | undefined;
}) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const distanceKm = "distance_km" in r ? r.distance_km : r.total_distance_km;
        const timeMin = "time_min" in r ? r.time_min : r.total_time_min;
        const count = "count" in r ? r.count : null;
        return (
          <div key={r.sport} className="flex justify-between text-sm gap-2">
            <span className="opacity-80">
              {SPORT_LABEL[r.sport] || r.sport}
              {count != null ? ` · ${count}×` : ""}
            </span>
            <span className="text-right opacity-70">
              {distanceKm > 0 && `${distanceKm} km · `}
              {formatMinutes(timeMin)}
              {r.avg_pace_s_per_km ? ` · ${formatPaceSPerKm(r.avg_pace_s_per_km)}` : ""}
              {r.avg_hr_bpm ? ` · ${r.avg_hr_bpm} bpm` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- main ---------- */

export default function DetailPlanSummary() {
  const { userId } = useUserId() as any;
  const t = useT();

  const [row, setRow] = useState<PlanSummaryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await apiGetLatestPlanSummary(userId);
      setRow(r);
    } catch (e: any) {
      setError(t(e?.message as any) || t("coachPlanSummary.errorLoad" as any));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const handleGenerate = useCallback(async () => {
    if (!userId || generating) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await apiGenerateMilestoneSummary(userId);
      if (!res?.ok) {
        setGenerateError(
          res?.reason === "no_active_plan"
            ? t("coachPlanSummary.errorNoActivePlan" as any)
            : t("coachPlanSummary.generateError" as any),
        );
        setGenerating(false);
        return;
      }
      await loadLatest();
      setGenerating(false);
    } catch (e: any) {
      setGenerateError(t(e?.message as any) || t("coachPlanSummary.generateError" as any));
      setGenerating(false);
    }
  }, [userId, generating, loadLatest, t]);

  const generateButton = (
    <Button
      variant="primary"
      size="md"
      onClick={handleGenerate}
      disabled={generating || !userId}
      leftIcon={generating ? <LoadingSpinner size="button" /> : undefined}
    >
      {generating
        ? t("coachPlanSummary.generating" as any)
        : t("coachPlanSummary.generateNow" as any)}
    </Button>
  );

  if (!userId)
    return (
      <Card
        title={t("coachPlanSummary.title" as any)}
        subtitle={t("common.errors.missingUserAuth" as any)}
      >
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin" as any)}</div>
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

  if (error || !row)
    return (
      <div className={PANEL_STACK}>
        <Card
          title={t("coachPlanSummary.title" as any)}
          subtitle={t("coachPlanSummary.noDataTitle" as any)}
        >
          <div className={PANEL_PREVIEW}>
            {error ?? t("coachPlanSummary.noDataDesc" as any)}
          </div>
        </Card>
        <Card footer={false}>
          <div className="flex flex-col items-center gap-2 py-1">
            {generateButton}
            {generateError && (
              <div
                className={[PANEL_PREVIEW, "text-pretty text-center"].join(" ")}
                style={{ color: appColors.statusError }}
              >
                {generateError}
              </div>
            )}
          </div>
        </Card>
      </div>
    );

  const ai = row.raw_ai_json;
  const hs = row.hard_stats;

  // 🔧 Defenzívne prístupy - hs môže byť starý tvar (pred refaktorom
  // hard_stats na plan_stats/combined_stats/unmatched_stats), preto VŠADE
  // optional chaining s fallbackom, aby stránka nikdy nespadla ani na
  // starých riadkoch v DB.
  const compliance = hs?.compliance;
  const planStatsBySport = hs?.plan_stats?.by_sport ?? [];
  const combinedStatsBySport = hs?.combined_stats?.by_sport ?? [];
  const unmatchedCount = hs?.unmatched_stats?.count ?? 0;
  const unmatchedBySport = hs?.unmatched_stats?.by_sport ?? [];
  const avgSessionDuration =
    hs?.plan_stats?.avg_session_duration_min ?? hs?.avg_session_duration_min ?? null;

  return (
    <div className={PANEL_STACK}>
      <Card
        title={row.race_name || t("coachPlanSummary.checkpointTitle" as any)}
        subtitle={[
          formatDate(row.race_date),
          row.is_plan_completed
            ? t("coachPlanSummary.tagCompleted" as any)
            : t("coachPlanSummary.tagCheckpoint" as any),
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {ai?.headline && (
          <p className={PANEL_PREVIEW} style={{ fontWeight: 600 }}>
            {ai.headline}
          </p>
        )}
        {ai?.summary_text && (
          <p className={[PANEL_PREVIEW, "text-pretty"].join(" ")}>
            {ai.summary_text}
          </p>
        )}

        {(row.race_target_time || row.race_actual_time_s) && (
          <div className="grid gap-3 md:grid-cols-2 min-w-0">
            <Subcard
              title={t("coachPlanSummary.targetTime" as any)}
              value={row.race_target_time || "—"}
            />
            <Subcard
              title={t("coachPlanSummary.actualTime" as any)}
              value={formatTimeS(row.race_actual_time_s)}
              valueColor={achievedColor(ai?.achieved_target)}
            />
          </div>
        )}

        {compliance && (
          <>
            <div className="grid gap-3 md:grid-cols-3 min-w-0">
              <Subcard
                title={t("coachPlanSummary.stats.completion" as any)}
                value={
                  compliance.completion_pct != null
                    ? `${compliance.completion_pct}%`
                    : "—"
                }
              />
              <Subcard
                title={t("coachPlanSummary.stats.sessionsDone" as any)}
                value={compliance.done}
              />
              <Subcard
                title={t("coachPlanSummary.stats.avgSessionDuration" as any)}
                value={formatMinutes(avgSessionDuration)}
              />
            </div>
            <div className="text-xs opacity-60">
              {t("coachPlanSummary.stats.weeksTracked" as any)}: {hs?.weeks_tracked ?? "—"}
              {" · "}
              {t("coachPlanSummary.stats.missed" as any)}: {compliance.missed}
              {" · "}
              {t("coachPlanSummary.stats.postponed" as any)}: {compliance.postponed}
            </div>
          </>
        )}

        {planStatsBySport.length > 0 && (
          <Subcard title={t("coachPlanSummary.stats.planStatsTitle" as any)}>
            <SportStatsTable rows={planStatsBySport} />
          </Subcard>
        )}

        {combinedStatsBySport.length > 0 && (
          <Subcard title={t("coachPlanSummary.stats.combinedStatsTitle" as any)}>
            <SportStatsTable rows={combinedStatsBySport} />
          </Subcard>
        )}

        {unmatchedCount > 0 && (
          <Subcard title={t("coachPlanSummary.stats.unmatchedTitle" as any)}>
            <SportStatsTable rows={unmatchedBySport} />
          </Subcard>
        )}

        {ai?.highlights && ai.highlights.length > 0 && (
          <Subcard title={t("coachPlanSummary.highlights" as any)}>
            <ul className="list-disc list-inside text-sm space-y-1">
              {ai.highlights.map((h, i) => (
                <li key={i} className="text-pretty">{h}</li>
              ))}
            </ul>
          </Subcard>
        )}

        {ai?.areas_to_improve && ai.areas_to_improve.length > 0 && (
          <Subcard title={t("coachPlanSummary.areasToImprove" as any)}>
            <ul className="list-disc list-inside text-sm space-y-1">
              {ai.areas_to_improve.map((a, i) => (
                <li key={i} className="text-pretty">{a}</li>
              ))}
            </ul>
          </Subcard>
        )}

        {ai?.next_cycle_advice && (
          <Subcard title={t("coachPlanSummary.nextCycleAdvice" as any)}>
            <p className="text-sm text-pretty">{ai.next_cycle_advice}</p>
          </Subcard>
        )}
      </Card>

      <Card footer={false}>
        <div className="flex flex-col items-center gap-2 py-1">
          {generateButton}
          {generateError && (
            <div
              className={[PANEL_PREVIEW, "text-pretty text-center"].join(" ")}
              style={{ color: appColors.statusError }}
            >
              {generateError}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
