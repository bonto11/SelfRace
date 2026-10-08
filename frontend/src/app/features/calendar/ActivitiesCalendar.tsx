// src/features/calendar/ActivitiesCalendar.tsx
"use client";

import * as React from "react";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import Button from "@/app/shared/ui/components/Button";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle"; 

import {
  CALENDAR_CONTAINER,
  CALENDAR_CONTAINER_STYLE,
  CALENDAR_PAGE_WRAP,
  CALENDAR_TITLE_ROW,
  CALENDAR_TITLE,
  CALENDAR_NAV_ROW,
  CALENDAR_NAV_NUDGE,
  CALENDAR_MONTH_LABEL,
  CALENDAR_ERROR_LINE,
  NO_X_OVERFLOW,
} from "@/app/shared/ui/tokens";

import { eventDateIso } from "@/app/features/calendar/utils/calendarSlots";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";

import CalendarGrid from "@/app/features/calendar/grid/CalendarGrid";
import DayDetail from "@/app/features/calendar/detail/DayDetail";

import { useCalendarExternals } from "@/app/features/calendar/hooks/useCalendarExternals";
import { useCalendarMap } from "@/app/features/calendar/hooks/useCalendarMap";
import { gridRange42 } from "@/app/features/calendar/utils/calendarDates";
import { isRestSession } from "@/app/features/calendar/utils/calendarFormat";
import { useT } from "@/app/shared/i18n/useT";
import { MarkLegend } from "@/app/shared/ui/widget/WidgetParts";
import { appLocale } from "@/app/shared/i18n/locale";
import { sk } from "@/app/shared/i18n/locales/sk";

// PREČO zoznam z i18n: kalendár predtým poznal len 8 športov (podľa farieb)
// a futbal, turistiku či jogu zhodil na "Iný šport". Platný je každý šport,
// ktorý má preklad; farbu si SportBadge dohľadá sám.
const KNOWN_SPORTS = new Set(Object.keys(sk.common.sports));

function safeSportKey(v: any): string {
  const s = String(v || "").toLowerCase();
  return KNOWN_SPORTS.has(s) ? s : "other";
}


export default function ActivitiesCalendar({
  year: yy,
  month: mm,
}: {
  year?: number;
  month?: number;
}) {
  const { userId } = useUserId();
  const t = useT();

  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

  const { plan } = useCoachData();
  const { rows: planRows } = plan;

  const { rows: actRows, ensureMonthLoaded } = useActivityData();

  // dotiahni dáta pre aktuálne zobrazený mesiac, ak nie je pokrytý
  // globálnym rolling rangeom providera (napr. mesiac spred 120 dní)
  React.useEffect(() => {
    void ensureMonthLoaded(year, month0);
  }, [year, month0, ensureMonthLoaded]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIso(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const range = React.useMemo(() => gridRange42(year, month0), [year, month0]);
  const externals = useCalendarExternals(userId, range);

  // Externé aktivity sa už neskrývajú podľa športu plánu/aktivity v ten deň -
  // BE ich spáruje s aktivitou zo Stravy (activity_id) a tá sa potom
  // nezobrazí druhýkrát. Nespárovaná externá aktivita je vlastná udalosť.
  const filteredExternalRows = React.useMemo(
    () => (externals.rows ?? []) as ExternalEvent[],
    [externals.rows],
  );

  const map = useCalendarMap({
    year,
    month0,
    actRows,
    planRows: planRows as any[],
    externalRows: filteredExternalRows,
    safeSportKey,
  });

  const jump = (dir: -1 | 1) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + dir);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  const [label, setLabel] = React.useState("");

  const currentLocale = React.useMemo(() => {
    return appLocale();
  }, [t]);

  React.useEffect(() => {
    const d = new Date(year, month0, 1);
    let text = d.toLocaleDateString(currentLocale, { month: "long", year: "numeric" });
    text = text.charAt(0).toUpperCase() + text.slice(1);
    setLabel(text);
  }, [year, month0, currentLocale]);

  const selectedPlanRows = React.useMemo(() => {
    if (!selectedIso) return [];
    return (planRows as any[]).filter((p: any) => {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso !== selectedIso) return false;
      const sess: any = p.payload ?? p;
      return !isRestSession(p, sess);
    });
  }, [planRows, selectedIso]);

  const selectedExternalRows = React.useMemo(() => {
    if (!selectedIso) return [];
    return (filteredExternalRows as ExternalEvent[]).filter((ev) => {
      const dIso = eventDateIso(ev);
      return dIso === selectedIso;
    });
  }, [filteredExternalRows, selectedIso]);

  const actMap = React.useMemo(() => {
    const m = new Map<number, any>();
    for (const r of actRows) {
      const id = Number((r as any).activity_id);
      if (!Number.isNaN(id)) m.set(id, r);
    }
    return m;
  }, [actRows]);

  return (
    <div className={[CALENDAR_PAGE_WRAP, NO_X_OVERFLOW].join(" ")}>
      <div className={CALENDAR_CONTAINER} style={CALENDAR_CONTAINER_STYLE}>
        
        <div className="mb-4">
          <ShowAdvancedToggle />
        </div>

        <div className={CALENDAR_TITLE_ROW}>
          <h2 className={CALENDAR_TITLE}> </h2>

          <div className={[CALENDAR_NAV_ROW, CALENDAR_NAV_NUDGE].join(" ")}>
            <Button variant="ghost" size="sm" circle aria-label={t("calendar.pastMonth")} onClick={() => jump(-1)}>
              ‹
            </Button>
            <div className={CALENDAR_MONTH_LABEL}>{label}</div>
            <Button variant="ghost" size="sm" circle aria-label={t("calendar.nextMonth")} onClick={() => jump(1)}>
              ›
            </Button>
          </div>
        </div>

        <div className="mt-2 mb-1">
          <MarkLegend
            titles={{
              plan: t("calendar.marks.plan"),
              activity: t("calendar.marks.activity"),
              done: t("calendar.marks.done"),
              missed: t("calendar.marks.missed"),
              postponed: t("calendar.marks.postponed"),
            }}
          />
        </div>

        {externals.err && (
          <div className={CALENDAR_ERROR_LINE}>{externals.err}</div>
        )}

        <CalendarGrid
          cells={map.cells} // 👈 TOTO BOLA CHYBA, TypeScriptu vadilo niečo iné, ale teraz to bude sedieť
          selectedIso={selectedIso}
          setSelectedIso={setSelectedIso}
        />
      </div>

      {selectedIso && (
        <DayDetail
          selectedIso={selectedIso}
          actRows={actRows}
          planRowsForDay={selectedPlanRows}
          externalRows={selectedExternalRows}
          safeSportKey={safeSportKey}
          actMap={actMap}
        />
      )}
    </div>
  );
}
