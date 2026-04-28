// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";

import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import SessionCard from "@/app/shared/components/session/SessionCard";

import { buildDayBuckets } from "@/app/features/calendar/detail/buildDayBuckets";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

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

  // 🌟 TU JE OPRAVA: Odfiltrujeme 'skipped' tréningy predtým, než ich pošleme do buildDayBuckets
  const filteredPlanRows = React.useMemo(() => {
    return planRowsForDay.filter((p: any) => {
       const status = p.status || p.planRaw?.status;
       return status !== "skipped";
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
                    dates: plan.rangeStart ? [plan.rangeStart, plan.rangeEnd] : [], 
                    onChangeDate: async ({ sessionId, fromDate, toDate }) => {
                       // Tu by mal ísť call na API ak to chceš presúvať priamo odtiaľto
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