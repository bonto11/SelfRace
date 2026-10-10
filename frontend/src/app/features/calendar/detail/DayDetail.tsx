// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";

import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import SessionCard from "@/app/shared/components/session/SessionCard";

import { buildDayBuckets } from "@/app/features/calendar/detail/buildDayBuckets";
import { apiSaveDailyReschedule } from "@/app/features/coach/api/coach_plan_daily";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { toast } from "@/app/shared/ui/components/Toast";
import { appLocale } from "@/app/shared/i18n/locale";
import { useRouter } from "next/navigation";
import { ChevronRight, Dumbbell } from "lucide-react";
import type { LoggedStrength } from "@/app/features/calendar/utils/loggedStrength";

type Props = {
  selectedIso: string;
  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];
  safeSportKey: (v: any) => string;
  actMap?: Map<number, any>;
  /** tréning, ktorý sa má rozbaliť (odkaz zo správy) */
  focus?: { planId: number | null; activityId: number | null } | null;
  /** odcvičené ručné zápisy silového tréningu (bez Stravy) */
  strengthRows?: LoggedStrength[];
};

const FOCUS_EL_ID = "sr-focus-session";

export default function DayDetail({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
  focus = null,
  strengthRows,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { userId } = useUserId();
  const { plan } = useCoachData();
  
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;
  
  const [isMounted, setIsMounted] = React.useState(false);
  const [localLabel, setLocalLabel] = React.useState("");

  React.useEffect(() => {
    setIsMounted(true);
    
    if (selectedIso) {
      const d = new Date(selectedIso);
      setLocalLabel(
        d.toLocaleDateString(appLocale(), {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      );
    }
  }, [selectedIso]);

  // 🌟 TU JE OPRAVA: Odfiltrujeme 'postponed' tréningy predtým, než ich pošleme do buildDayBuckets
  const filteredPlanRows = React.useMemo(() => {
    return planRowsForDay.filter((p: any) => {
       const status = p.status || p.planRaw?.status;
       return status !== "postponed";
    });
  }, [planRowsForDay]);

  // Voľný zápis silového tréningu – zápis k plánu toho dňa otvára karta plánu.
  const dayLogs = React.useMemo(() => {
    const planIds = new Set(planRowsForDay.map((p: any) => Number(p.id)));
    return (strengthRows ?? []).filter(
      (l) => l.date === selectedIso && !(l.planSessionId != null && planIds.has(Number(l.planSessionId))),
    );
  }, [strengthRows, selectedIso, planRowsForDay]);

  const { past, planned } = React.useMemo(
    () =>
      buildDayBuckets({
        selectedIso,
        actRows,
        planRowsForDay: filteredPlanRows, // 👈 Použijeme odfiltrované pole
        externalRows,
        safeSportKey,
        t,
      }),
    [selectedIso, actRows, filteredPlanRows, externalRows, safeSportKey, t],
  );

  // 🌟 OPRAVA: predtým sa do planReschedule.dates posielalo len
  // [plan.rangeStart, plan.rangeEnd] - dva krajné dátumy CELÉHO nahraného
  // rozsahu (90 dní dozadu / 15 dopredu), takže SelectField ponúkal len tieto
  // 2 extrémne hodnoty namiesto skutočných dní s plánom. Teraz vyberáme
  // všetky reálne dni, na ktoré existuje aspoň jedna plán session (rovnaká
  // logika ako v DetailDailyPlan.tsx), plus počet session na deň pre limit
  // "max 2 za deň".
  const { rescheduleDates, dayCounts } = React.useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);

    const isRestRow = (r: any) => {
      const dur = r.duration_min;
      return dur == null || Number(dur) === 0;
    };

    const counts: Record<string, number> = {};
    let lastPlanDate: string | null = null;
    for (const r of plan.rows) {
      const d = String(r.plan_date ?? "").slice(0, 10);
      if (!d || d < todayIso) continue;
      if (!isRestRow(r)) {
        counts[d] = (counts[d] ?? 0) + 1;
      }
      if (!lastPlanDate || d > lastPlanDate) lastPlanDate = d;
    }

    // Súvislý rozsah dní od dneška po posledný deň, na ktorý existuje
    // vygenerovaný plán (nie len dni, ktoré už niečo majú) - aby sa dalo
    // presunúť aj na "prázdny" deň v rámci vygenerovaného týždňa/plánu.
    const dates: string[] = [];
    if (lastPlanDate) {
      let cur = new Date(todayIso);
      const end = new Date(lastPlanDate);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }

    return { rescheduleDates: dates, dayCounts: counts };
  }, [plan.rows]);

  // Odkaz na konkrétny tréning (správa od trénera / zverenca): karta sa
  // rozbalí (key s focus = nový mount, defaultOpen platí len pri mounte)
  // a stránka k nej doskroluje.
  const isFocused = (it: any) =>
    !!focus &&
    ((focus.planId != null && Number(it.planId) === focus.planId) ||
      (focus.activityId != null && Number(it.activityId) === focus.activityId));
  const focusedItem = (it: any) => (isFocused(it) ? { ...it, defaultOpen: true } : it);
  const focusKey = (it: any) => (isFocused(it) ? `${it.id}-focus` : it.id);

  const scrolledFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!focus) return;
    const k = `${selectedIso}:${focus.planId}:${focus.activityId}`;
    if (scrolledFor.current === k) return;
    const el = document.getElementById(FOCUS_EL_ID);
    if (!el) return;
    scrolledFor.current = k;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, selectedIso, past, planned]);

  const sectionStyle: React.CSSProperties = {
    color: appColors.textMuted,
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: `1px solid ${appColors.surfaceCardBorder}`,
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div className="mt-3 ml-1 space-y-4">
      {/* PAST - Realizované aktivity a zmapované tréningy */}
      <div className="space-y-2">
        <div
          className="text-[11px] uppercase tracking-wide"
          style={sectionStyle}
        >
           {t("calendar.past")} — {localLabel}
        </div>

        {dayLogs.length ? (
          <ul className="space-y-2">
            {dayLogs.map((l) => (
              <li key={`s-${l.id}`}>
                <button
                  type="button"
                  onClick={() => router.push(`/activities/strength/${l.id}`)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors cursor-pointer"
                  style={{ background: appColors.surfaceCard, border: `1px solid ${appColors.surfaceCardBorder}` }}
                >
                  <span
                    className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: appColors.surfaceSolid }}
                  >
                    <Dumbbell size={16} color={appColors.chartStrength} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: appColors.textPrimary }}>
                      {l.title || t("common.sports.strength")}
                    </span>
                    <span className="block text-xs" style={{ color: appColors.textMuted }}>
                      {fmt(t("calendar.strengthLog"), { exercises: l.exercises, sets: l.sets })}
                    </span>
                  </span>
                  <ChevronRight size={16} color={appColors.textMuted} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {past.length === 0 && !dayLogs.length ? (
          <div className="text-sm opacity-70">
            {t("calendar.noActivity")}
          </div>
        ) : past.length === 0 ? null : (
          <ul className="space-y-2">
            {past.map((it: any) => (
              <li key={focusKey(it)} id={isFocused(it) ? FOCUS_EL_ID : undefined} className="px-0">
                <SessionCard 
                  variant="calendar" 
                  item={focusedItem(it)} 
                  showAdvanced={showAdvanced}
                  onRefreshPlan={() => plan.refresh()}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={dividerStyle} />

      {/* PLANNED - Naplánované a zmeškané tréningy */}
      <div className="space-y-2">
        <div
          className="text-[11px] uppercase tracking-wide"
          style={sectionStyle}
        >
           {t("calendar.planPlaned")} — {localLabel}
        </div>

        {planned.length === 0 ? (
          <div className="text-sm opacity-70">
             {t("calendar.noActivity")}
          </div>
        ) : (
          <ul className="space-y-2">
            {planned.map((it: any) => (
              <li key={focusKey(it)} id={isFocused(it) ? FOCUS_EL_ID : undefined} className="px-0">
                <SessionCard 
                  variant="calendar" 
                  item={focusedItem(it)} 
                  showAdvanced={showAdvanced}
                  onRefreshPlan={() => plan.refresh()}
                  planReschedule={{
                    enabled: true,
                    dates: rescheduleDates,
                    dayCounts,
                    maxPerDay: 2,
                    onChangeDate: async ({ sessionId, fromDate, toDate }) => {
                       if (sessionId == null || !userId) return;
                       try {
                         const result = await apiSaveDailyReschedule(Number(userId), [
                           { id: sessionId, from_date: fromDate, to_date: toDate },
                         ]);
                         if (process.env.NODE_ENV !== "production") {
                           console.log("[DayDetail][reschedule-debug]", {
                             sessionId,
                             fromDate,
                             toDate,
                             userId,
                             result,
                           });
                         }
                       } catch (e: any) {
                         if (process.env.NODE_ENV !== "production") {
                           console.log("[DayDetail][reschedule-debug] ERROR", {
                             sessionId,
                             fromDate,
                             toDate,
                             userId,
                             error: e,
                             message: e?.message,
                           });
                         }
                         toast.error(t(e?.message as any) || t("common.error"));
                         return;
                       }
                       toast.success(t("common.done"));
                       plan.refresh();
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}