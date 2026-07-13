// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";

import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import SessionCard from "@/app/shared/components/session/SessionCard";

import { buildDayBuckets } from "@/app/features/calendar/detail/buildDayBuckets";
import { apiSaveDailyReschedule } from "@/app/features/coach/api/coach_plan_daily";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { toast } from "@/app/shared/ui/components/Toast";

type Props = {
  selectedIso: string;
  actRows: any[];
  planRowsForDay: any[];
  externalRows: ExternalEvent[];
  safeSportKey: (v: any) => string;
  actMap?: Map<number, any>;
};

export default function DayDetail({
  selectedIso,
  actRows,
  planRowsForDay,
  externalRows,
  safeSportKey,
}: Props) {
  const t = useT();
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
        d.toLocaleDateString("sk-SK", {
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
    const counts: Record<string, number> = {};
    for (const r of plan.rows) {
      const d = String(r.plan_date ?? "").slice(0, 10);
      if (!d || d < todayIso) continue;
      counts[d] = (counts[d] ?? 0) + 1;
    }
    const dates = Object.keys(counts).sort();
    return { rescheduleDates: dates, dayCounts: counts };
  }, [plan.rows]);

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

        {past.length === 0 ? (
          <div className="text-sm opacity-70">
            {t("calendar.noActivity")}
          </div>
        ) : (
          <ul className="space-y-2">
            {past.map((it: any) => (
              <li key={it.id} className="px-0">
                <SessionCard 
                  variant="calendar" 
                  item={it} 
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
              <li key={it.id} className="px-0">
                <SessionCard 
                  variant="calendar" 
                  item={it} 
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
                         toast.error(t(e?.message as any) || t("common.error") || "Chyba");
                         return;
                       }
                       toast.success(t("common.done") || "Uložené");
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
