// src/shared/components/widgets/WidgetActivitiesCalendar.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref } from "@/app/features/prefs/api/prefs";
import MiniCalendar from "@/app/shared/ui/components/MiniCalendar";
import { useT } from "@/app/shared/i18n/useT";
import { NO_X_OVERFLOW } from "@/app/shared/ui/tokens/core";

type Props = {
  openHref?: string;
  perDayLimit?: number;
};

export default function WidgetActivitiesCalendar({
  openHref = "/calendar",
  perDayLimit = 6,
}: Props) {
  const router = useRouter();
  const { userId, isChecking } = useUserId();
  const t = useT();

  const [isMedicalSuspend, setIsMedicalSuspend] = React.useState(false);
  const [activeInjury, setActiveInjury] = React.useState<{
    severity: number;
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (!userId || isChecking) return;
    (async () => {
      try {
        const prefsRes = await apiFetchUserPref(userId, "coach.prefs");
        if (prefsRes && Array.isArray(prefsRes.injuries) && prefsRes.injuries.length > 0) {
          const maxInjury = prefsRes.injuries.reduce((prev: any, current: any) => {
            return (current.severity || 0) > (prev.severity || 0) ? current : prev;
          }, { severity: 0 });

          if (maxInjury && maxInjury.severity > 0) {
            setIsMedicalSuspend(maxInjury.severity >= 7);
            setActiveInjury({
              severity: maxInjury.severity,
              text: `${t(`prefs.sections.injuriesSection.areas.${maxInjury.area}` as any) || maxInjury.area} (${maxInjury.severity}/10)`,
            });
          }
        } else {
          setActiveInjury(null);
          setIsMedicalSuspend(false);
        }
      } catch (err) {
        console.warn("[CalendarWidget] Failed to check injury state", err);
      }
    })();
  }, [userId, isChecking, t]);

  const handleOpen = () => router.push(openHref);

  return (
    <WidgetCard
      title={t("calendar.widget.title")}
      tooltip={t("calendar.widget.tooltip" as any)}
      onOpen={handleOpen}
      accent={isMedicalSuspend ? "danger" : "none"}
      interactive
      minH={160}
      innerClassName={NO_X_OVERFLOW}
    >
      <div className="flex flex-col h-full min-h-[110px]">
        <div className="flex-1">
          
          {activeInjury && (
            <div
              className={`mb-3 px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${
                activeInjury.severity >= 7
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}
            >
              <div className="flex-shrink-0">⚠️</div>
              <div className="leading-tight">
                <strong>{t("common.injury.reported")}</strong> {activeInjury.text}
                <div className="opacity-80 text-[10px] mt-0.5">
                  {activeInjury.severity >= 7
                    ? t("common.injury.calendar")
                    : t("common.injury.planAdjusted")}
                </div>
              </div>
            </div>
          )}

          <MiniCalendar 
            startFrom="monday" 
            content="all" 
            perDayLimit={perDayLimit} 
            onOpen={handleOpen} 
          />

        </div>
      </div>
    </WidgetCard>
  );
}