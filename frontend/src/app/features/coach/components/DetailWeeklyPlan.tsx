// src/app/features/coach/components/DetailWeeklyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";
import { useT } from "@/app/shared/i18n/useT";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_ACTIONS_INLINE,
  ACCORDION_FOOTER_BAR_MUTED,
  PANEL_PHASE_PILL_STYLE,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
  SESSION_PILL,
} from "@/app/shared/ui/tokens/sessionCard";
import { appColors } from "@/app/shared/ui/theme/app_colors";

/* ---------- helpers ---------- */

type PhaseKey = "base" | "build" | "peak" | "taper" | "recovery" | "other";

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sk-SK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function phaseKey(load_phase?: string | null): PhaseKey {
  const l = (load_phase || "").toLowerCase();
  if (l.startsWith("base")) return "base";
  if (l.startsWith("build")) return "build";
  if (l.startsWith("peak")) return "peak";
  if (l.startsWith("taper")) return "taper";
  if (l.startsWith("recovery") || l.startsWith("deload")) return "recovery";
  return "other";
}

/* ---------- mini progress bar ---------- */
function MiniBar({
  label,
  actual,
  planned,
  unit,
  colorHex,
}: {
  label: string;
  actual: number;
  planned: number;
  unit: string;
  colorHex: string;
}) {
  if (planned === 0 && actual === 0) return null;

  const pct =
    planned > 0
      ? Math.min(100, (actual / planned) * 100)
      : actual > 0
        ? 100
        : 0;

  const isOver = planned > 0 && actual > planned;

  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-end text-[10px] uppercase tracking-wide opacity-80 mb-1">
        <span>{label}</span>
        <span className={isOver ? "text-emerald-400 font-bold" : ""}>
          {actual} / {planned} {unit}
        </span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: `${colorHex}33` }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: colorHex }}
        />
      </div>
    </div>
  );
}

/* ---------- card wrapper ---------- */
function Card({
  title,
  subtitle,
  children,
  headRight,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  headRight?: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle || headRight) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            )}
          </div>
          {headRight && <div>{headRight}</div>}
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

export default function DetailWeeklyPlan() {
  const { userId } = useUserId();
  const t = useT();
  const [plan, setPlan] = useState<WeeklyPlanLatest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestWeeklyPlan(userId);
        if (alive) setPlan(r ?? null);
      } catch (e: any) {
        if (alive)
          setError(t(e?.message as any) || t("coach.weekly.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, t]);

  const view = useMemo(() => {
    if (!plan?.weeks?.length)
      return { weeksSorted: [], rangeLabel: null, phaseCounts: {} as any };
    const weeksSorted = [...plan.weeks].sort(
      (a, b) => (a.week_index || 0) - (b.week_index || 0),
    );
    const firstStr = formatDate(weeksSorted[0].week_start);
    const lastStr = formatDate(weeksSorted[weeksSorted.length - 1].week_end);

    const phaseCounts: any = {};
    for (const w of weeksSorted) {
      const pk = phaseKey(w.load_phase);
      phaseCounts[pk] = (phaseCounts[pk] || 0) + 1;
    }

    return {
      weeksSorted,
      rangeLabel: firstStr && lastStr ? `${firstStr} – ${lastStr}` : firstStr,
      phaseCounts,
    };
  }, [plan]);

  const getPhaseLabel = (phaseStr?: string | null) => {
    if (!phaseStr) return "?";
    const safeKey = phaseStr.toLowerCase().replace(/ /g, "_");
    const key = `common.phases.${safeKey}`;
    const translated = (t as any)(key);
    return translated === key ? phaseStr : translated;
  };

  const formatHrs = (mins: number) => Math.round((mins / 60) * 10) / 10;

  if (!userId)
    return (
      <Card
        title={t("coachWeekly.title")}
        subtitle={t("common.errors.missingUserAuth")}
      >
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  if (loading)
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "grid place-items-center"].join(" ")}>
          <LoadingSpinner size="widget" />
        </div>
      </section>
    );
  if (error || !plan || !view.weeksSorted.length)
    return (
      <Card
        title={t("coachWeekly.title")}
        subtitle={t("coach.weekly.noPlanTitle")}
      >
        <div className={PANEL_PREVIEW}>
          {error ?? t("coach.weekly.noPlanDesc")}
        </div>
      </Card>
    );

  return (
    <div className={PANEL_STACK}>
      <Card
        title={t("coach.weekly.overviewTitle")}
        subtitle={
          <>
            {t("coach.weekly.overviewSubtitle")}
            {view.rangeLabel && (
              <span className="block">
                {t("coach.weekly.range")}: {view.rangeLabel}
              </span>
            )}
          </>
        }
        headRight={
          <div className="text-right text-xs opacity-80">
            <div>
              {t("coachWeekly.widget.weeksCount")}:{" "}
              <b>{view.weeksSorted.length}</b>
            </div>
          </div>
        }
      >
        <div className={PANEL_ACTIONS_INLINE}>
          {(Object.keys(view.phaseCounts) as PhaseKey[])
            .filter((k) => view.phaseCounts[k] > 0)
            .map((k) => (
              <div
                key={k}
                className={SESSION_PILL}
                style={PANEL_PHASE_PILL_STYLE[k]}
              >
                <span className="opacity-90">
                  {t(`coach.weekly.phases.${k}` as any)}
                </span>
                <span className="font-semibold tabular-nums">
                  {view.phaseCounts[k]}×
                </span>
              </div>
            ))}
        </div>
      </Card>

      <Card
        title={t("coach.weekly.weeksTitle")}
        subtitle={t("coach.weekly.volumeBars")}
      >
        <div className={PANEL_STACK}>
          {view.weeksSorted.map((w: WeeklyPlanWeek) => {
            const pk = phaseKey(w.load_phase);
            const ps = w.planned_stats || {};
            const as = w.actual_stats || {};

            const totalPMin =
              (ps.run_time_min || 0) +
              (ps.bike_time_min || 0) +
              (ps.swim_time_min || 0) +
              (ps.strength_time_min || 0) +
              (ps.other_time_min || 0);
            const totalAMin =
              (as.run_time_min || 0) +
              (as.bike_time_min || 0) +
              (as.swim_time_min || 0) +
              (as.strength_time_min || 0) +
              (as.other_time_min || 0);

            return (
              <div
                key={w.week_index}
                className={SESSION_SUBCARD}
                style={SESSION_SUBCARD_STYLE}
              >
                <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold uppercase opacity-90">
                        {t("common.weeksSelect.count1")} {w.week_index}
                      </span>
                      <span
                        className={SESSION_PILL}
                        style={PANEL_PHASE_PILL_STYLE[pk]}
                      >
                        {getPhaseLabel(w.load_phase)}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-70">
                      {formatDate(w.week_start)} – {formatDate(w.week_end)}
                    </div>
                  </div>

                  <div className="text-sm font-semibold">
                    {w.goal || w.focus || t("coach.weekly.noGoalShort")}
                  </div>
                  {w.notes && (
                    <div className="text-xs italic opacity-70 mb-2">
                      {w.notes}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 mt-2">
                    <MiniBar
                      label={`${t("common.sports.run")} (${t("common.metrics.distance")})`}
                      actual={as.run_distance_km || 0}
                      planned={ps.run_distance_km || 0}
                      unit={t("common.units.km")}
                      colorHex={appColors.chartRun}
                    />
                    <MiniBar
                      label={`${t("common.sports.run")} (${t("common.metrics.time")})`}
                      actual={formatHrs(as.run_time_min || 0)}
                      planned={formatHrs(ps.run_time_min || 0)}
                      unit={t("common.units.hour")}
                      colorHex={appColors.chartRun}
                    />

                    <MiniBar
                      label={`${t("common.sports.bike")} (${t("common.metrics.distance")})`}
                      actual={as.bike_distance_km || 0}
                      planned={ps.bike_distance_km || 0}
                      unit={t("common.units.km")}
                      colorHex={appColors.chartBike}
                    />
                    <MiniBar
                      label={`${t("common.sports.bike")} (${t("common.metrics.time")})`}
                      actual={formatHrs(as.bike_time_min || 0)}
                      planned={formatHrs(ps.bike_time_min || 0)}
                      unit={t("common.units.hour")}
                      colorHex={appColors.chartBike}
                    />

                    <MiniBar
                      label={`${t("common.sports.swim")} (${t("common.metrics.distance")})`}
                      actual={(as.swim_distance_m || 0) / 1000}
                      planned={(ps.swim_distance_m || 0) / 1000}
                      unit={t("common.units.km")}
                      colorHex={appColors.chartSwim}
                    />

                    <MiniBar
                      label={t("common.sports.strength" as any)}
                      actual={formatHrs(as.strength_time_min || 0)}
                      planned={formatHrs(ps.strength_time_min || 0)}
                      unit={t("common.units.hour")}
                      colorHex={appColors.chartStrength}
                    />

                    <div className="mt-2 pt-2 border-t border-white/5">
                      <MiniBar
                        label={`${t("common.together")} (${t("common.metrics.time")})`}
                        actual={formatHrs(totalAMin)}
                        planned={formatHrs(totalPMin)}
                        unit={t("common.units.hour")}
                        colorHex={appColors.chartOther}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}