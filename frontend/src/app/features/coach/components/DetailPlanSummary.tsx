// src/app/features/coach/components/DetailPlanSummary.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiListPlanSummaries,
  apiGenerateMilestoneSummary,
  type PlanSummaryRecord,
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

/* ---------- building blocks (rovnaké ako v DetailAthleteState) ---------- */

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

function formatDate(iso: string | null, t: any) {
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

function achievedColor(achieved: boolean | null | undefined): string | undefined {
  if (achieved === true) return appColors.statusSuccess;
  if (achieved === false) return appColors.stateWarning;
  return undefined;
}

/* ---------- main ---------- */

export default function DetailPlanSummary() {
  const { userId } = useUserId() as any;
  const t = useT();

  const [items, setItems] = useState<PlanSummaryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await apiListPlanSummaries(userId);
      setItems(rows);
    } catch (e: any) {
      setError(t(e?.message as any) || t("coachPlanSummary.errorLoad" as any));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

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
      await loadItems();
      setGenerating(false);
    } catch (e: any) {
      setGenerateError(t(e?.message as any) || t("coachPlanSummary.generateError" as any));
      setGenerating(false);
    }
  }, [userId, generating, loadItems, t]);

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

  if (error || items.length === 0)
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

  return (
    <div className={PANEL_STACK}>
      {items.map((row) => {
        const ai = row.raw_ai_json;
        const hs = row.hard_stats;
        return (
          <Card
            key={row.id}
            title={row.race_name || t("coachPlanSummary.checkpointTitle" as any)}
            subtitle={[
              formatDate(row.race_date, t),
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

            {/* 🌟 TVRDÉ DÁTA Z BE — nezávislé od AI, počítané vždy rovnako z DB */}
            {hs && (
              <Subcard title={t("coachPlanSummary.stats.title" as any)}>
                <div className="grid gap-3 md:grid-cols-3 min-w-0">
                  <Subcard
                    title={t("coachPlanSummary.stats.completion" as any)}
                    value={
                      hs.compliance.completion_pct != null
                        ? `${hs.compliance.completion_pct}%`
                        : "—"
                    }
                  />
                  <Subcard
                    title={t("coachPlanSummary.stats.sessionsDone" as any)}
                    value={hs.compliance.done}
                  />
                  <Subcard
                    title={t("coachPlanSummary.stats.avgSessionDuration" as any)}
                    value={
                      hs.avg_session_duration_min != null
                        ? `${hs.avg_session_duration_min} min`
                        : "—"
                    }
                  />

                  {hs.actual_totals.run_distance_km != null && (
                    <Subcard
                      title={t("coachPlanSummary.stats.totalRunKm" as any)}
                      value={`${hs.actual_totals.run_distance_km} km`}
                    />
                  )}
                  {hs.weekly_averages.run_distance_km != null && (
                    <Subcard
                      title={t("coachPlanSummary.stats.avgRunKmPerWeek" as any)}
                      value={`${hs.weekly_averages.run_distance_km} km`}
                    />
                  )}
                  {hs.actual_totals.strength_time_min != null && (
                    <Subcard
                      title={t("coachPlanSummary.stats.totalStrengthMin" as any)}
                      value={`${hs.actual_totals.strength_time_min} min`}
                    />
                  )}
                </div>

                <div className="text-xs opacity-60 mt-2">
                  {t("coachPlanSummary.stats.weeksTracked" as any)}: {hs.weeks_tracked}
                  {" · "}
                  {t("coachPlanSummary.stats.missed" as any)}: {hs.compliance.missed}
                  {" · "}
                  {t("coachPlanSummary.stats.postponed" as any)}: {hs.compliance.postponed}
                </div>
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
        );
      })}

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