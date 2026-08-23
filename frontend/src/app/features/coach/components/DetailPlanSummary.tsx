// src/app/features/coach/components/DetailPlanSummary.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestPlanSummary,
  apiGenerateMilestoneSummary,
  type PlanSummaryRecord,
  type SportStatsRow,
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

const SPORT_META: Record<string, { label: string; icon: string }> = {
  run: { label: "Beh", icon: "🏃" },
  ride: { label: "Bicykel", icon: "🚴" },
  swim: { label: "Plávanie", icon: "🏊" },
  strength: { label: "Posilňovanie", icon: "🏋️" },
  other: { label: "Iné", icon: "⚡" },
};

/* ---------- sport row card ---------- */

function SportRowCard({ row }: { row: SportStatsRow }) {
  const meta = SPORT_META[row.sport] || { label: row.sport, icon: "⚡" };

  const metrics: { label: string; value: string }[] = [];
  if (row.distance_km > 0) metrics.push({ label: "Vzdialenosť", value: `${row.distance_km} km` });
  metrics.push({ label: "Čas", value: formatMinutes(row.time_min) });
  if (row.avg_pace_s_per_km) metrics.push({ label: "Tempo", value: formatPaceSPerKm(row.avg_pace_s_per_km) });
  if (row.avg_speed_kmh) metrics.push({ label: "Rýchlosť", value: `${row.avg_speed_kmh} km/h` });
  if (row.avg_hr_bpm) metrics.push({ label: "Tep", value: `${row.avg_hr_bpm} bpm` });

  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: appColors.surfaceSolid,
        border: `1px solid ${appColors.surfaceCardBorder}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none">{meta.icon}</span>
        <span className="text-sm font-bold" style={{ color: appColors.textPrimary }}>
          {meta.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-[70px]">
            <div className="text-[10px] uppercase tracking-wide opacity-50">{m.label}</div>
            <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- toggle: Celkovo / Len plán ---------- */

function StatsScopeToggle({
  scope,
  onChange,
}: {
  scope: "combined" | "plan";
  onChange: (s: "combined" | "plan") => void;
}) {
  return (
    <div
      className="inline-flex rounded-full p-0.5"
      style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
    >
      {(["combined", "plan"] as const).map((opt) => {
        const active = scope === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: active ? appColors.buttonMainBg : "transparent",
              color: active ? appColors.buttonMainText : appColors.textSecondary,
            }}
          >
            {opt === "combined" ? "Celkovo" : "Len plán"}
          </button>
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

  const [scope, setScope] = useState<"combined" | "plan">("combined");

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

  const compliance = hs?.compliance;
  const planStatsBySport = hs?.plan_stats?.by_sport ?? [];
  const combinedStatsBySport = hs?.combined_stats?.by_sport ?? [];
  const avgSessionDuration =
    hs?.plan_stats?.avg_session_duration_min ?? hs?.avg_session_duration_min ?? null;

  const activeSportRows = scope === "combined" ? combinedStatsBySport : planStatsBySport;

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
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">
                {t("coachPlanSummary.targetTime" as any)}
              </div>
              <div className="text-base font-bold" style={{ color: appColors.textPrimary }}>
                {row.race_target_time || "—"}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">
                {t("coachPlanSummary.actualTime" as any)}
              </div>
              <div
                className="text-base font-bold"
                style={{ color: achievedColor(ai?.achieved_target) ?? appColors.textPrimary }}
              >
                {formatTimeS(row.race_actual_time_s)}
              </div>
            </div>
          </div>
        )}

        {compliance && (
          <div className="grid gap-3 md:grid-cols-3 min-w-0">
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">
                {t("coachPlanSummary.stats.completion" as any)}
              </div>
              <div className="text-base font-bold" style={{ color: appColors.textPrimary }}>
                {compliance.completion_pct != null ? `${compliance.completion_pct}%` : "—"}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">
                {t("coachPlanSummary.stats.sessionsDone" as any)}
              </div>
              <div className="text-base font-bold" style={{ color: appColors.textPrimary }}>
                {compliance.done}
              </div>
            </div>
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-50 mb-1">
                {t("coachPlanSummary.stats.avgSessionDuration" as any)}
              </div>
              <div className="text-base font-bold" style={{ color: appColors.textPrimary }}>
                {formatMinutes(avgSessionDuration)}
              </div>
            </div>
          </div>
        )}

        {compliance && (
          <div className="text-xs opacity-60">
            {t("coachPlanSummary.stats.weeksTracked" as any)}: {hs?.weeks_tracked ?? "—"}
            {" · "}
            {t("coachPlanSummary.stats.missed" as any)}: {compliance.missed}
            {" · "}
            {t("coachPlanSummary.stats.postponed" as any)}: {compliance.postponed}
          </div>
        )}

        {activeSportRows.length > 0 && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider opacity-60">
                {t("coachPlanSummary.stats.bySportTitle" as any)}
              </div>
              <StatsScopeToggle scope={scope} onChange={setScope} />
            </div>
            <div className="space-y-2">
              {activeSportRows.map((r) => (
                <SportRowCard key={r.sport} row={r} />
              ))}
            </div>
          </div>
        )}

        {ai?.highlights && ai.highlights.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider opacity-60">
              {t("coachPlanSummary.highlights" as any)}
            </div>
            <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
              {ai.highlights.map((h, i) => (
                <li key={i} className="text-pretty">{h}</li>
              ))}
            </ul>
          </div>
        )}

        {ai?.areas_to_improve && ai.areas_to_improve.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider opacity-60">
              {t("coachPlanSummary.areasToImprove" as any)}
            </div>
            <ul className="list-disc list-inside text-sm space-y-1 opacity-90">
              {ai.areas_to_improve.map((a, i) => (
                <li key={i} className="text-pretty">{a}</li>
              ))}
            </ul>
          </div>
        )}

        {ai?.next_cycle_advice && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider opacity-60">
              {t("coachPlanSummary.nextCycleAdvice" as any)}
            </div>
            <p className="text-sm opacity-90 text-pretty">{ai.next_cycle_advice}</p>
          </div>
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
