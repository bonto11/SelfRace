// src/app/features/coach/components/DetailDailyPlan.tsx
"use client";

import { useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { confirm } from "@/app/shared/ui/components/Confirm";
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

  const { settings } = useSettings() as any; 
  const showAdvanced = settings?.show_advanced ?? false; 

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 🌟 Vytiahneme globálne dáta
  const { plan: { rows: globalRows }, loading: isGlobalLoading, refresh: refreshCoach } = useCoachData();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [showAllDays, setShowAllDays] = useState(false); 
  const [moves, setMoves] = useState<DailyRescheduleMove[]>([]);

  // 🌟 Pretransformujeme globálne riadky do pôvodnej štruktúry 'days'
  const days = useMemo(() => {
    if (!globalRows || !Array.isArray(globalRows)) return [];
    
    const daysMap = new Map<string, any>();
    
    // Predpokladáme zobrazenie +- 7 dní (alebo celého rozsahu z DB)
    for (const r of globalRows) {
      const pDate = String(r.plan_date).slice(0, 10);
      if (!daysMap.has(pDate)) {
        daysMap.set(pDate, { date: pDate, sessions: [] });
      }
      daysMap.get(pDate).sessions.push(r);
    }

    // Sortneme od najstaršieho po najnovší
    return Array.from(daysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [globalRows]);

  const hasPlan = days.length > 0;

  const filteredDays = useMemo(() => {
    if (showAllDays) return days;
    const list = days.filter((d) => d.date === selectedDate);
    return list;
  }, [days, showAllDays, selectedDate]);

  const planDates = useMemo(() => {
    const out: string[] = [];
    const base = new Date(); 
    // Horizon necháme hardcoded na 7 dní dopredu, keďže to postačuje
    for (let i = 0; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, []);
  
  const dayCounts = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const d of days) {
      if (!d.date) continue;
      out[d.date] = d.sessions?.length ?? 0;
    }
    return out;
  }, [days]);

  const dirty = moves.length > 0;

  const addMove = (m: DailyRescheduleMove) => {
    // ⚠️ Keďže teraz máme SSOT z providera, local override zrušíme, aby to nerobilo ghosting bugy. 
    // Používateľ rovno uloží zmeny, čím zabezpečíme konzistenciu.
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
      // 🌟 Globálny refresh!
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

  if (!userId) {
    return (
      <Card title={t("coach.daily.scheduleTitle")} subtitle={t("common.errors.missingUserAuth")}>
        <div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div>
      </Card>
    );
  }

  // Loading zobrazíme len pri prvotnom loade
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

  // Odfiltrujeme 'postponed'
  const daysForList = filteredDays.map(day => ({
    ...day,
    sessions: (day.sessions || []).filter((s: any) => s.status !== "postponed")
  }));

  const hasVisibleSessions = daysForList.some(d => d.sessions && d.sessions.length > 0);

  return (
    <div className={PANEL_STACK}>
      {hasPlan && <ShowAdvancedToggle />}

      {hasPlan && (
        <div className="mb-2 space-y-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
             <MiniCalendar 
               startFrom="today" 
               content="plan" 
               selectedDateIso={showAllDays ? undefined : selectedDate} 
               onSelectDate={handleSelectDate} 
             />
          </div>
          
          <Toggle 
            label={t("coach.daily.toggleAllWeek")}
            checked={showAllDays}
            onChange={setShowAllDays}
          />
        </div>
      )}

      <Card
        title={t("coach.daily.scheduleTitle")}
        subtitle={t("coach.daily.scheduleSubtitle")}
      >
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
          <div className={PANEL_PREVIEW}>
            {t("coach.daily.noSessionsOnDay")}
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
                // Aby sme zachovali payload (ak existuje) alebo len surový objekt
                const rawData = s.payload ?? s;

                const kpis: KPI[] = [];
                if (rawData.duration_min) kpis.push({ label: t("common.metrics.duration").toUpperCase(), value: `${rawData.duration_min} ${t("common.units.min")}` });
                if (rawData.intensity) kpis.push({ label: t("common.metrics.intensity").toUpperCase(), value: String(rawData.intensity) });

                const item: PlanSession = {
                  id: s.id,
                  kind: "plan",
                  status: s.status || "planned",
                  title: rawData.title || rawData.session_type || rawData.sport || t("coach.daily.sessionFallback"),
                  dateIso,
                  sport: rawData.sport || "other",
                  subtitle: `${dateLabel}${wd ? ` · ${wd.toUpperCase()}` : ""}`,
                  kpis,
                  notes: rawData.notes ?? null,
                  planDur: rawData.duration_min ? `${rawData.duration_min} ${t("common.units.min")}` : null,
                  planIntensity: rawData.intensity ?? null,
                  planNotes: rawData.notes ?? null,
                  planRaw: s, // Ukladame cely DB riadok pre pripadne volania
                  planStructure: rawData.structure ?? null,
                  planExercises: (rawData.structure?.strength_exercises as any[]) ?? [],
                };

                return (
                  <SessionCard
                    key={item.id}
                    variant="calendar"
                    item={item}
                    showAdvanced={showAdvanced}
                    // 🌟 REFRESH PO postpone/MATCHi
                    onRefreshPlan={() => refreshCoach(false)}
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