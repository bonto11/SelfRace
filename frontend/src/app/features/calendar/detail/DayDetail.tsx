// src/features/calendar/detail/DayDetail.tsx
"use client";

import * as React from "react";

import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import SessionCard from "@/app/shared/components/session/SessionCard";

import { buildDayBuckets } from "@/app/features/calendar/detail/buildDayBuckets";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  selectedIso: string;
  // selectedLabel sme odstránili z Props
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
  
  // 1. Ochrana proti Hydration Error: Uistíme sa, že renderujeme až na klientovi
  const [isMounted, setIsMounted] = React.useState(false);
  const [localLabel, setLocalLabel] = React.useState("");

  React.useEffect(() => {
    setIsMounted(true);
    
    // Tu si DayDetail sám a bezpečne vygeneruje formátovaný dátum
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

  // buildDayBuckets necháme tak, ale vyrenderuje sa bezpečne až na klientovi
  const { past, planned } = React.useMemo(
    () =>
      buildDayBuckets({
        selectedIso,
        actRows,
        planRowsForDay,
        externalRows,
        safeSportKey,
        t,
      }),
    [selectedIso, actRows, planRowsForDay, externalRows, safeSportKey, t],
  );

  const sectionStyle: React.CSSProperties = {
    color: appColors.textMuted,
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: `1px solid ${appColors.surfaceCardBorder}`,
  };

  // 2. Ak komponent ešte nie je "mounted" na klientovi, nezobrazujeme nič (alebo len prázdny obal),
  // čím zabránime nesúladu medzi serverom a prehliadačom
  if (!isMounted) {
    return null; // alebo <div className="mt-3 ml-1 h-20" /> ako placeholder
  }

  return (
    <div className="mt-3 ml-1 space-y-4">
      {/* PAST */}
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
                <SessionCard variant="calendar" item={it} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={dividerStyle} />

      {/* PLANNED */}
      <div className="space-y-2">
        <div
          className="text-[11px] uppercase tracking-wide"
          style={sectionStyle}
        >
           {t("calendar.planPlaned")} — {localLabel}
        </div>

        {planned.length === 0 ? (
          <div className="text-sm opacity-70">
             {t("calendar.noPlanned")}
          </div>
        ) : (
          <ul className="space-y-2">
            {planned.map((it: any) => (
              <li key={it.id} className="px-0">
                <SessionCard variant="calendar" item={it} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}