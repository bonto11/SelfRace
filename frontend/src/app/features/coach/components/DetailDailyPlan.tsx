// src/app/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";

import {
  apiGetDailyOverview,
  apiSaveDailyReschedule,
  type DailyOverview,
  type DailyPlanDay,
  type DailyRescheduleMove,
} from "@/app/features/coach/api/coach_plan_daily";

import SessionCard, {
  type KPI,
  type PlanSession,
} from "@/app/shared/components/session/SessionCard";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";

/* ---------- helpers ---------- */

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString("sk-SK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function weekdayLabel(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString("sk-SK", { weekday: "short" });
}

/* ---------- tiny Card wrapper ---------- */

function Card({
  title,
  subtitle,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title ? <div className={PANEL_SECTION_TITLE}>{title}</div> : null}
            {subtitle ? (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            ) : null}
          </div>
        </header>
      )}

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>

      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

/* ---------- main ---------- */

export default function DetailDailyPlan() {
  const { userId } = useUserId();
  const t = useT();

  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [moves, setMoves] = useState<DailyRescheduleMove[]>([]);

  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetDailyOverview(userId);
        if (alive) {
          setOverview(r ?? null);
          setMoves([]); 
          setSaveError(null);
        }
      } catch (e: any) {
        if (alive) setError(t(e?.message as any) || t("coach.daily.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

  const days = overview?.days ?? [];
  const hasPlan = days.length > 0;

  const planDates = useMemo(() => {
    const h = overview?.horizon_days ?? 7;
    const out: string[] = [];
    const base = new Date(); 
    for (let i = 0; i <= h; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [overview?.horizon_days]);
  
  const dayCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of days) {
      if (!d.date) continue;
      out[d.date] = d.sessions?.length ?? 0;
    }
    return out;
  }, [days]);

  const dirty = moves.length > 0;

  const moveSessionLocal = (
    fromDate: string,
    toDate: string,
    sessionId: number,
  ) => {
    setOverview((prev) => {
      if (!prev) return prev;

      let moved: any = null;

      const daysNext: DailyPlanDay[] = prev.days.map((d) => {
        if (d.date === fromDate) {
          const next = [...(d.sessions ?? [])];
          const i = next.findIndex(
            (x: any) => Number(x?.id) === Number(sessionId),
          );
          if (i >= 0) {
            moved = next[i];
            next.splice(i, 1);
          }
          return { ...d, sessions: next };
        }
        return d;
      });

      if (!moved) return prev;

      const daysNext2: DailyPlanDay[] = daysNext.map((d) => {
        if (d.date === toDate) {
          const moved2 = { ...moved, plan_date: toDate };
          return { ...d, sessions: [...(d.sessions ?? []), moved2] };
        }
        return d;
      });

      return { ...prev, days: daysNext2 };
    });
  };

  const addMove = (m: DailyRescheduleMove) => {
    setMoves((prev) => [...prev, m]);
  };

  const undoLast = () => {
    setMoves((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      moveSessionLocal(last.to_date, last.from_date, Number(last.id));
      return prev.slice(0, -1);
    });
  };

  const saveMoves = async () => {
    if (!userId || !dirty || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const next = await apiSaveDailyReschedule(userId, moves);
      if (next) {
        setOverview(next);
      }
      setMoves([]);
    } catch (e: any) {
      setSaveError(t(e?.message as any) || t("coach.daily.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  if (!userId) {
    return (
      <Card title={t("coach.daily.detailTitle")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  if (loading) {
    return (
      <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
        <div className={[PANEL_PAD, "flex items-center gap-2"].join(" ")}>
          <LoadingSpinner size="button" />
          <div className={PANEL_PREVIEW}>{t("coach.daily.loading")}</div>
        </div>
        <div className={ACCORDION_FOOTER_BAR_MUTED} />
      </section>
    );
  }

  if (error) {
    return (
      <Card title={t("coach.daily.detailTitle")} subtitle={t("coach.daily.errorLoadTitle")}>
        <div className={PANEL_PREVIEW}>{error}</div>
      </Card>
    );
  }

  return (
    <div className={PANEL_STACK}>
      <Card
        title={t("coach.daily.detailTitle")}
      >
        {!hasPlan ? (
          <div className={PANEL_PREVIEW}>
            {t("coach.daily.noPlan")}
          </div>
        ) : (
          <div className={PANEL_PREVIEW}>
            {t("coach.daily.rescheduleNotice")}
          </div>
        )}
      </Card>

      <Card
        title={t("coach.daily.scheduleTitle")}
        subtitle={t("coach.daily.scheduleSubtitle")}
      >
        {hasPlan ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs opacity-70">
                {dirty 
                  ? t("coach.daily.unsavedChanges").replace("{{count}}", String(moves.length)) 
                  : t("coach.daily.allSaved")}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={!dirty || saving}
                  onClick={async () => {
                    if (!dirty) return;
                    const ok = await confirm({
                      title: t("coach.daily.undoConfirmTitle"),
                      message: t("coach.daily.undoConfirmMessage"),
                      okText: t("common.undo"),
                      cancelText: t("common.cancel"),
                      tone: "danger",
                    });
                    if (ok) undoLast();
                  }}
                >
                  {t("common.undo")}
                </Button>

                <Button
                  size="xs"
                  variant="primary"
                  disabled={!dirty || saving}
                  onClick={saveMoves}
                >
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>

            {saveError ? (
              <div className="mt-1 text-[11px] text-red-300">{saveError}</div>
            ) : null}
          </div>
        ) : null}

        {!hasPlan ? (
          <div className={PANEL_PREVIEW}>—</div>
        ) : (
          <div className={PANEL_STACK}>
            {days.flatMap((d) => {
              if (!d.date) return [];
              if (!d.sessions || d.sessions.length === 0) return [];

              const dateIso = d.date;
              const dateLabel = formatDate(d.date) ?? d.date;
              const wd = weekdayLabel(d.date) ?? "";

              return d.sessions.map((s: any) => {
                const kpis: KPI[] = [];
                if (s.duration_min)
                  kpis.push({
                    label: t("common.metrics.duration").toUpperCase(),
                    value: `${s.duration_min} ${t("common.units.min")}`,
                  });
                if (s.intensity)
                  kpis.push({ 
                    label: t("common.metrics.intensity").toUpperCase(), 
                    value: String(s.intensity) 
                  });
                if (s.zone_text)
                  kpis.push({ 
                    label: t("common.metrics.target").toUpperCase(), 
                    value: String(s.zone_text) 
                  });

                const item: PlanSession = {
                  id: s.id,
                  kind: "plan",
                  status: "planned",
                  title: s.title || s.session_type || s.sport || t("coach.daily.sessionFallback"),
                  dateIso,
                  sport: s.sport || "other",
                  subtitle: `${dateLabel}${wd ? ` · ${wd.toUpperCase()}` : ""}`,
                  kpis,
                  notes: s.notes ?? null,

                  planDur: s.duration_min ? `${s.duration_min} ${t("common.units.min")}` : null,
                  planIntensity: s.intensity ?? null,
                  planTarget: s.zone_text ?? null,
                  planNotes: s.notes ?? null,

                  planRaw: s,
                  planStructure: s.structure ?? null,
                  planExercises: (s.structure?.strength_exercises as any[]) ?? [],
                };

                return (
                  <SessionCard
                    key={item.id}
                    variant="calendar"
                    item={item}
                    planReschedule={{
                      enabled: true,
                      dates: planDates,
                      dayCounts,
                      maxPerDay: 2,
                      onChangeDate: ({ sessionId, fromDate, toDate }) => {
                        if (sessionId == null) return;
                        addMove({
                          id: sessionId,
                          from_date: fromDate,
                          to_date: toDate,
                        });
                        moveSessionLocal(fromDate, toDate, Number(sessionId));
                      },
                    }}
                  />
                );
              });
            })}
          </div>
        )}
      </Card>
    </div>
  );
}