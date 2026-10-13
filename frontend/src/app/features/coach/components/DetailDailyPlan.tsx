// src/app/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useExternalPlanRows } from "@/app/features/coach/hooks/useExternalPlanRows";
import { useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle";
import Toggle from "@/app/shared/ui/components/Toggle";
import MiniCalendar from "@/app/shared/ui/components/MiniCalendar";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

import {
  apiSaveDailyReschedule,
  type DailyRescheduleMove,
  type DailyPlanSession,
} from "@/app/features/coach/api/coach_plan_daily";
import { apiDeleteManualSession } from "@/app/features/coach/api/advisor_daily";

import SessionCard, {
  type KPI,
  type SessionItem,
} from "@/app/shared/components/session/SessionCard";
import ManualSessionForm from "@/app/features/coach/components/ManualSessionForm";
import RaceDayCards from "@/app/features/calendar/detail/RaceDayCards";

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
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";
import { appLocale } from "@/app/shared/i18n/locale";
import { appColors } from "@/app/shared/ui/theme/app_colors";

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
  return d.toLocaleDateString(appLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function weekdayLabel(value: string | null | undefined): string | null {
  const d = toDate(value);
  if (!d) return null;
  return d.toLocaleDateString(appLocale(), { weekday: "short" });
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

const MAX_SESSIONS_PER_DAY = 2; // rovnako ako BE (coach_plan_daily_manual)
// plán sa načítava 90 dní dozadu a 15 dopredu (CoachDataProvider)
const MIN_WEEK_OFFSET = -4;
const MAX_WEEK_OFFSET = 1;

/** "13. 10." - krátky dátum pre rozsah týždňa */
function shortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString(appLocale(), { day: "numeric", month: "numeric" });
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  /**
   * 🌟 NOVÉ: advisor režim - keď true, zobrazí sa "+ Pridať tréning" a
   * na každej karte Upraviť/Vymazať. Coach režim (default) ostáva presne
   * ako predtým, čisto na čítanie.
   */
  editable?: boolean;
};

export default function DetailDailyPlan({ editable = false }: Props) {
  const { userId } = useUserId();
  const t = useT();

  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  // lokálny dátum (toISOString je UTC - po polnoci by ukázal včerajšok)
  const todayIso = useMemo(() => localIso(new Date()), []);

  // PREČO týždeň od pondelka so šípkami: plán aj hodnotenie poradcu idú po
  // týždňoch. V nedeľu sa rovno ukáže budúci týždeň - vtedy sa plánuje.
  const isSunday = useMemo(() => new Date().getDay() === 0, []);
  const [weekOffset, setWeekOffset] = useState(isSunday ? 1 : 0);
  const weekDates = useMemo(() => {
    const monday = new Date();
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return localIso(d);
    });
  }, [weekOffset]);

  const { plan: { rows: globalRows }, loading: isGlobalLoading, refresh: refreshCoach } = useCoachData();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() =>
    isSunday ? weekDates[0] : todayIso,
  );
  const [showAllDays, setShowAllDays] = useState(false);
  const [moves, setMoves] = useState<DailyRescheduleMove[]>([]);

  // 🌟 NOVÉ: stav formulára pre pridanie/úpravu ručného tréningu.
  // null = zavretý. { mode: "create" } = nová session na selectedDate.
  // { mode: "edit", session } = úprava existujúcej.
  const [formState, setFormState] = useState<
    | null
    | { mode: "create"; planDate: string }
    | { mode: "edit"; session: DailyPlanSession }
  >(null);

  const planDates = weekDates;

  const changeWeek = (delta: number) => {
    const next = Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, weekOffset + delta));
    if (next === weekOffset) return;
    setWeekOffset(next);
    // vybraný deň v novom týždni: dnes, ak v ňom je, inak pondelok
    const monday = new Date();
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + next * 7);
    const mondayIso = localIso(monday);
    const sundayDate = new Date(monday);
    sundayDate.setDate(monday.getDate() + 6);
    const sundayIso = localIso(sundayDate);
    setSelectedDate(todayIso >= mondayIso && todayIso <= sundayIso ? todayIso : mondayIso);
  };

  const weekLabel =
    weekOffset === 0
      ? t("coach.daily.weekThis")
      : weekOffset === 1
        ? t("coach.daily.weekNext")
        : weekOffset === -1
          ? t("coach.daily.weekPrev")
          : `${shortDate(weekDates[0])} – ${shortDate(weekDates[6])}`;

  // Externé aktivity (futbal v stredu) - v coach_plan_daily nie sú,
  // zlúčia sa sem až pri zobrazení, za tréningy daného dňa.
  const externalRows = useExternalPlanRows(userId, planDates[0], planDates[planDates.length - 1]);

  const days = useMemo(() => {
    if (!globalRows || !Array.isArray(globalRows)) return [];

    const daysMap = new Map<string, any>();

    for (const r of [...globalRows, ...externalRows]) {
      const pDate = String(r.plan_date).slice(0, 10);
      if (!daysMap.has(pDate)) {
        daysMap.set(pDate, { date: pDate, sessions: [] });
      }
      daysMap.get(pDate).sessions.push(r);
    }

    return Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [globalRows, externalRows]);

  // plán = riadky z coach_plan_daily; samotné externé aktivity plán nerobia
  const hasPlan = Array.isArray(globalRows) && globalRows.length > 0;

  const filteredDays = useMemo(() => {
    if (showAllDays) {
      const allowedDates = new Set(planDates);
      return days.filter((d) => allowedDates.has(d.date));
    }
    const list = days.filter((d) => d.date === selectedDate);
    return list;
  }, [days, showAllDays, selectedDate, planDates]);

  const dayCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of days) {
      if (!d.date) continue;
      // externé aktivity nie sú tréningy plánu - nerátajú sa do limitu na deň
      out[d.date] = (d.sessions ?? []).filter((s: any) => !s.is_external).length;
    }
    return out;
  }, [days]);

  const dirty = moves.length > 0;

  const addMove = (m: DailyRescheduleMove) => {
    setMoves((prev) => [...prev, m]);
  };

  const undoLast = () => {
    setMoves((prev) => prev.slice(0, -1));
  };

  const saveMoves = async () => {
    if (!userId || !dirty || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiSaveDailyReschedule(userId, moves);
      setMoves([]);
      refreshCoach(false);
    } catch (e: any) {
      setSaveError(t(e?.message as any));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectDate = (isoDate: string) => {
    setSelectedDate(isoDate);
    setShowAllDays(false);
  };

  // 🌟 NOVÉ: handlery pre editable mode
  // Plný deň (2 tréningy) by skončil chybou - predvyplní sa najbližší voľný
  // deň od vybraného. Deň je vo formulári vidieť a dá sa zmeniť.
  const openAddForm = (planDate: string) => {
    let date = planDate < todayIso ? todayIso : planDate;
    for (let i = 0; i < 14 && (dayCounts[date] ?? 0) >= MAX_SESSIONS_PER_DAY; i++) {
      const d = new Date(`${date}T12:00:00`);
      d.setDate(d.getDate() + 1);
      date = localIso(d);
    }
    setFormState({ mode: "create", planDate: date });
  };

  const openEditForm = async (sessionId: number) => {
    // Nájdeme session v globalRows podľa id (planId, ktoré posiela SessionCard)
    const row = (globalRows || []).find((r: any) => Number(r.id) === sessionId);
    if (!row) {
      toast.error(t("common.error") || "Chyba");
      return;
    }
    setFormState({ mode: "edit", session: row as unknown as DailyPlanSession });
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!userId) return;
    try {
      await apiDeleteManualSession(userId, sessionId);
      toast.success(t("common.deleted") || "Odstránené");
      refreshCoach(false);
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("common.error") || "Chyba");
    }
  };

  const closeForm = () => setFormState(null);

  const handleFormSaved = () => {
    refreshCoach(false);
  };

  if (!userId) {
    return (
      <Card title={t("coach.daily.scheduleTitle")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  if (isGlobalLoading && days.length === 0) {
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

  const daysForList = filteredDays.map(day => ({
    ...day,
    sessions: (day.sessions || []).filter((s: any) => s.status !== "postponed")
  }));

  const hasVisibleSessions = daysForList.some(d => d.sessions && d.sessions.length > 0);

  return (
    <div className={PANEL_STACK}>
      {formState && (
        <ManualSessionForm
          planDate={formState.mode === "create" ? formState.planDate : String(formState.session.plan_date || selectedDate)}
          planMetaId={null}
          initialSession={formState.mode === "edit" ? formState.session : null}
          onClose={closeForm}
          onSaved={handleFormSaved}
        />
      )}

      {hasPlan && <ShowAdvancedToggle />}

      {hasPlan && (
        <div className="mb-2 space-y-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
             <div className="flex items-center justify-between gap-2 mb-2">
               <button
                 type="button"
                 onClick={() => changeWeek(-1)}
                 disabled={weekOffset <= MIN_WEEK_OFFSET}
                 className="w-8 h-8 rounded-full text-lg leading-none disabled:opacity-25"
                 style={{ color: appColors.textPrimary }}
                 aria-label={t("coach.daily.weekPrev")}
               >
                 ‹
               </button>
               <div className="text-center min-w-0">
                 <div className="text-sm font-semibold">{weekLabel}</div>
                 <div className="text-[11px] opacity-60">
                   {shortDate(weekDates[0])} – {shortDate(weekDates[6])}
                 </div>
               </div>
               <button
                 type="button"
                 onClick={() => changeWeek(1)}
                 disabled={weekOffset >= MAX_WEEK_OFFSET}
                 className="w-8 h-8 rounded-full text-lg leading-none disabled:opacity-25"
                 style={{ color: appColors.textPrimary }}
                 aria-label={t("coach.daily.weekNext")}
               >
                 ›
               </button>
             </div>
             <MiniCalendar
               startFrom="monday"
               weekOffset={weekOffset}
               selectedDateIso={showAllDays ? undefined : selectedDate}
               onSelectDate={handleSelectDate}
             />
          </div>

          <div className={PANEL_ACTIONS_INLINE} style={{ justifyContent: "space-between" }}>
            <Toggle
              label={t("coach.daily.toggleAllWeek")}
              checked={showAllDays}
              onChange={setShowAllDays}
            />

            {editable && !showAllDays && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => openAddForm(selectedDate)}
              >
                + {t("advisorDaily.addButton") || "Pridať tréning"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 🌟 NOVÉ: keď plán ešte neexistuje vôbec (advisor bez ani jedného
          tréningu), umožníme pridať prvý priamo na dnešný deň. */}
      {!hasPlan && editable && (
        <div className={[PANEL_ACTIONS_INLINE, "justify-center"].join(" ")}>
          <Button size="sm" variant="primary" onClick={() => openAddForm(todayIso)}>
            + {t("advisorDaily.addButton") || "Pridať tréning"}
          </Button>
        </div>
      )}

      <Card
        title={t("coach.daily.scheduleTitle")}
        subtitle={t("coach.daily.scheduleSubtitle")}
      >
        {/* preteky vybraného dňa (z cieľov, nie z plánu) */}
        {!showAllDays && <RaceDayCards dateIso={selectedDate} className="mb-3" />}
        {hasPlan && dirty ? (
          <div className="flex flex-col gap-2 mb-2">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs opacity-70">
                  {t("coach.daily.unsavedChanges").replace("{{count}}", String(moves.length))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={!dirty || saving}
                    onClick={async () => {
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
          </div>
        ) : null}

        {!hasPlan ? (
          <div className={PANEL_PREVIEW}>{t("coach.daily.noPlan")}</div>
        ) : !hasVisibleSessions ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className={PANEL_PREVIEW}>
              {t("coach.daily.noSessionsOnDay")}
            </div>
            {editable && !showAllDays && (
              <Button size="xs" variant="secondary" onClick={() => openAddForm(selectedDate)}>
                + {t("advisorDaily.addButton") || "Pridať tréning"}
              </Button>
            )}
          </div>
        ) : (
          <div className={PANEL_STACK}>
            {daysForList.flatMap((d) => {
              if (!d.date) return [];
              if (!d.sessions || d.sessions.length === 0) return [];

              const dateIso = d.date;
              const dateLabel = formatDate(d.date) ?? d.date;
              const wd = weekdayLabel(d.date) ?? "";

              return d.sessions.map((s: any) => {
                const rawData = s.payload ?? s;

                const kpis: KPI[] = [];
                if (rawData.duration_min) kpis.push({ label: t("common.metrics.duration").toUpperCase(), value: `${rawData.duration_min} ${t("common.units.min")}` });
                if (rawData.intensity) kpis.push({ label: t("common.metrics.intensity").toUpperCase(), value: String(rawData.intensity) });

                const rawActId = s.activity_id;
                const activityId =
                  rawActId != null && !Number.isNaN(Number(rawActId))
                    ? Number(rawActId)
                    : null;

                const item: SessionItem = {
                  id: s.id,
                  kind: "session",
                  status: s.status || "planned",
                  title: rawData.title || rawData.session_type || rawData.sport || t("coach.daily.sessionFallback"),
                  dateIso,
                  sport: rawData.sport || "other",
                  subtitle: `${dateLabel}${wd ? ` · ${wd.toUpperCase()}` : ""}`,
                  kpis,
                  notes: rawData.notes ?? null,

                  planId: s.id,
                  activityId,

                  planDur: rawData.duration_min ? `${rawData.duration_min} ${t("common.units.min")}` : null,
                  planIntensity: rawData.intensity ?? null,
                  planNotes: rawData.notes ?? null,
                  planRaw: s,
                  planStructure: rawData.structure ?? null,
                  planExercises: (rawData.structure?.strength_exercises as any[]) ?? [],
                };

                return (
                  <SessionCard
                    key={item.id}
                    variant="calendar"
                    item={item}
                    showAdvanced={showAdvanced}
                    onRefreshPlan={() => refreshCoach(false)}
                    editable={editable}
                    onEditSession={editable ? openEditForm : undefined}
                    onDeleteSession={editable ? handleDeleteSession : undefined}
                    planReschedule={{
                      enabled: true,
                      dates: planDates,
                      dayCounts,
                      maxPerDay: 2,
                      onChangeDate: ({ sessionId, fromDate, toDate }) => {
                        if (sessionId == null) return;
                        addMove({ id: sessionId, from_date: fromDate, to_date: toDate });
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