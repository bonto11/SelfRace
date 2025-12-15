"use client";

import * as React from "react";

import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { useUserId } from "@/shared/hooks/useUserId";

import { THEME } from "@/shared/theme/tokens";
import Button from "@/shared/components/ui/Button";
import { CALENDAR_CONTAINER, NO_X_OVERFLOW } from "@/shared/ui/classes";

import type { ExternalEvent } from "@/features/coach/types/externalEvents";

import CalendarGrid from "@/features/calendar/grid/CalendarGrid";
import DayDetail from "@/features/calendar/detail/DayDetail";
import { useCalendarExternals } from "@/features/calendar/hooks/useCalendarExternals";
import { useCalendarMap } from "@/features/calendar/hooks/useCalendarMap";
import { gridRange42 } from "@/features/calendar/utils/calendarDates";
import { isRestSession } from "@/features/calendar/utils/calendarFormat";

const SPORT_COLORS: Record<string, string> = {
  run: THEME.chart.run,
  ride: THEME.chart.ride,
  swim: THEME.chart.swim,
  strength: THEME.chart.strength,
  mixed: THEME.chart.mixed,
  skate: THEME.chart.skate,
  walk: THEME.chart.walk,
  other: THEME.chart.other,
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

  const today = new Date();
  const [year, setYear] = React.useState(yy ?? today.getFullYear());
  const [month0, setMonth0] = React.useState(mm ?? today.getMonth());
  const [selectedIso, setSelectedIso] = React.useState<string | null>(null);

  const { rows: planRows } = usePlanData();
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

  const map = useCalendarMap({
    year,
    month0,
    actRows,
    planRows,
    externalRows: externals.rows,
    safeSportKey,
  });

  const jump = (dir: -1 | 1) => {
    const d = new Date(year, month0, 1);
    d.setMonth(d.getMonth() + dir);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
    setSelectedIso(null);
  };

  const label = new Date(year, month0, 1).toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });

  const selectedLabel = React.useMemo(() => {
    if (!selectedIso) return "";
    const d = new Date(selectedIso);
    return d.toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [selectedIso]);

  const selectedPlanRows = React.useMemo(() => {
    if (!selectedIso) return [];
    return planRows.filter((p: any) => {
      const dIso = String(p.plan_date).slice(0, 10);
      if (dIso !== selectedIso) return false;
      const sess: any = p.payload ?? p;
      return !isRestSession(p, sess);
    });
  }, [planRows, selectedIso]);

  const actMap = React.useMemo(() => {
    const m = new Map<number, any>();
    for (const r of actRows) {
      const id = Number((r as any).activity_id);
      if (!Number.isNaN(id)) m.set(id, r);
    }
    return m;
  }, [actRows]);

  return (
    <div className={["space-y-3", NO_X_OVERFLOW].join(" ")}>
      <div className={CALENDAR_CONTAINER}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Kalendár aktivít</h2>

          <div className="flex items-center gap-2 translate-y-[2px]">
            <Button variant="ghost" size="sm" circle aria-label="Predchádzajúci mesiac" onClick={() => jump(-1)}>
              ‹
            </Button>

            <div className="mx-1 text-base font-semibold min-w-[160px] text-center">{label}</div>

            <Button variant="ghost" size="sm" circle aria-label="Nasledujúci mesiac" onClick={() => jump(1)}>
              ›
            </Button>
          </div>
        </div>

        {/* legenda */}
        <div className="mt-2 mb-1 flex flex-wrap gap-3 text-[11px] opacity-70">
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: THEME.chart.other }} />
            <span>external</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: THEME.chart.run }} />
            <span>aktivita</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full border" style={{ borderColor: THEME.chart.run, backgroundColor: "transparent" }} />
            <span>plán</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] leading-none" style={{ color: THEME.chart.run }}>✓</span>
            <span>splnený plán</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] leading-none" style={{ color: THEME.chart.run }}>×</span>
            <span>missed plán</span>
          </div>
        </div>

        {externals.err && (
          <div className="mt-1 mb-1 text-[11px] text-red-300 line-clamp-2">{externals.err}</div>
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
          selectedLabel={selectedLabel}
          actRows={actRows}
          planRowsForDay={selectedPlanRows}
          externalRows={externals.rows as ExternalEvent[]}
          safeSportKey={safeSportKey}
          actMap={actMap}
        />
      )}
    </div>
  );
}