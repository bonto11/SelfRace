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
  CALENDAR_LEGEND_WRAP,
  CALENDAR_LEGEND_ITEM,
  CALENDAR_LEGEND_DOT,
  CALENDAR_LEGEND_TINY,
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

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  walk: appColors.chartWalk,
  other: appColors.chartOther,
};

function safeSportKey(v: any): string {
  const s = String(v || "").toLowerCase();
  if (s in SPORT_COLORS) return s;
  return "other";
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

  const { rows: actRows } = useActivityData();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIso(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const range = React.useMemo(() => gridRange42(year, month0), [year, month0]);
  const externals = useCalendarExternals(userId, range);

  const planSlots = React.useMemo(() => {
    const slots = new Set<string>();
    for (const p of planRows as any[]) {
      const dIso = String(p.plan_date ?? "").slice(0, 10);
      if (!dIso) continue;

      const sess: any = p.payload ?? p;
      if (isRestSession(p, sess)) continue;

      const sportKey = safeSportKey(sess.sport ?? p.sport);
      slots.add(`${dIso}|${sportKey}`);
    }
    return slots;
  }, [planRows]);

  const activitySlots = React.useMemo(() => {
    const slots = new Set<string>();
    for (const a of actRows as any[]) {
      const dIso = String(a.date ?? "").slice(0, 10);
      if (!dIso) continue;
      const sportKey = safeSportKey(a.sport_type_fe ?? a.sport_type ?? a.sport);
      slots.add(`${dIso}|${sportKey}`);
    }
    return slots;
  }, [actRows]);

  const filteredExternalRows = React.useMemo(() => {
    const rows = (externals.rows ?? []) as ExternalEvent[];
    if (!rows.length) return rows;

    return rows.filter((ev) => {
      const dIso = eventDateIso(ev);
      if (!dIso) return false;

      const sportKey = safeSportKey(
        (ev as any).sport ?? (ev as any).sport_type,
      );
      const key = `${dIso}|${sportKey}`;

      if (planSlots.has(key)) return false;
      if (activitySlots.has(key)) return false;

      return true;
    });
  }, [externals.rows, planSlots, activitySlots]);

  // 🌟 Mágia sa deje vnútri useCalendarMap, ktorý generuje bunky pre grid
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
    const loc = t("common.locale" as any);
    if (loc === "common.locale") {
      return t("common.and" as any) === "and" ? "en-US" : "sk-SK";
    }
    return loc;
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

  const colPlan = appColors.chartRun;
  const colExternal = appColors.chartOther;
  const colActivity = appColors.chartRun;

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

        {/* 🌟 LEGENDA S NOVÝMI IKONAMI */}
        <div className={CALENDAR_LEGEND_WRAP}>
          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={CALENDAR_LEGEND_DOT} style={{ backgroundColor: colExternal }} />
            <span>{t("calendar.external")}</span>
          </div>

          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={CALENDAR_LEGEND_DOT} style={{ backgroundColor: colActivity }} />
            <span>{t("calendar.activity")}</span>
          </div>

          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={[CALENDAR_LEGEND_DOT, "border"].join(" ")} style={{ borderColor: colPlan, backgroundColor: "transparent" }} />
            <span>{t("calendar.plan")}</span>
          </div>

          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={CALENDAR_LEGEND_TINY} style={{ color: appColors.statusInfo }}>✓</span>
            <span>{t("calendar.planDone")}</span>
          </div>

          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={CALENDAR_LEGEND_TINY} style={{ color: appColors.statusWarning }}>✕</span>
            <span>{t("calendar.planMissed")}</span>
          </div>

          {/* NOVÉ: Odložené do restov */}
          <div className={CALENDAR_LEGEND_ITEM}>
            <span className={CALENDAR_LEGEND_TINY} style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>↷</span>
            <span>{t("calendar.planSkipped")}</span>
          </div>
        </div>

        {externals.err && (
          <div className={CALENDAR_ERROR_LINE}>{externals.err}</div>
        )}

        <CalendarGrid
          cells={map.cells}
          selectedIso={selectedIso}
          setSelectedIso={setSelectedIso}
          sportColors={SPORT_COLORS}
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