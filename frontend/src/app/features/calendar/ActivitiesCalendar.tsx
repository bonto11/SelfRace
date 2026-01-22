// src/features/calendar/ActivitiesCalendar.tsx
"use client";

import * as React from "react";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";

import { THEME } from "@/app/shared/theme/tokens";
import Button from "@/app/shared/components/ui/Button";
import { CALENDAR_CONTAINER, NO_X_OVERFLOW } from "@/app/shared/theme/uiTokens";
import { eventDateIso } from "@/app/features/calendar/utils/calendarSlots";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";

import CalendarGrid from "@/app/features/calendar/grid/CalendarGrid";
import DayDetail from "@/app/features/calendar/detail/DayDetail";
import { useCalendarExternals } from "@/app/features/calendar/hooks/useCalendarExternals";
import { useCalendarMap } from "@/app/features/calendar/hooks/useCalendarMap";
import { gridRange42 } from "@/app/features/calendar/utils/calendarDates";
import { isRestSession } from "@/app/features/calendar/utils/calendarFormat";
import {
  CALENDAR_CONTAINER,
  NO_X_OVERFLOW,
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
} from "@/app/shared/theme/uiTokens";
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

  // === NOVÉ: plán ide z CoachDataProvideru ===
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

  // ─────────────────────────────
  // 1) sety (date|sportKey), kde už je plán alebo aktivita
  // ─────────────────────────────
  const planSlots = React.useMemo(() => {
    const slots = new Set<string>();
    for (const p of planRows as any[]) {
      const dIso = String(p.plan_date ?? "").slice(0, 10);
      if (!dIso) continue;
      const sess: any = p.payload ?? p;
      if (isRestSession(p, sess)) continue;
      const sportKey = safeSportKey(sess.sport);
      slots.add(`${dIso}|${sportKey}`);
    }
    return slots;
  }, [planRows]);

  const activitySlots = React.useMemo(() => {
    const slots = new Set<string>();
    for (const a of actRows as any[]) {
      const dIso = String(a.date ?? "").slice(0, 10);
      if (!dIso) continue;
      const sportKey = safeSportKey(a.sport_type_fe ?? a.sport_type);
      slots.add(`${dIso}|${sportKey}`);
    }
    return slots;
  }, [actRows]);

  // ─────────────────────────────
  // 2) globálne odfiltrujeme external events
  // ─────────────────────────────
  const filteredExternalRows = React.useMemo(() => {
    const rows = (externals.rows ?? []) as ExternalEvent[];
    if (!rows.length) return rows;

    return rows.filter((ev) => {
      const dIso = eventDateIso(ev);
      if (!dIso) return false;

      const sportKey = safeSportKey(
        (ev as any).sport ?? (ev as any).sport_type
      );
      const key = `${dIso}|${sportKey}`;

      if (planSlots.has(key)) return false;
      if (activitySlots.has(key)) return false;

      return true;
    });
  }, [externals.rows, planSlots, activitySlots]);

  // ─────────────────────────────
  // 3) map pre grid – tu už (v hooku) prebehne dedupeCalendarItems
  // ─────────────────────────────
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
    <div className={CALENDAR_CONTAINER}>
      <div className={CALENDAR_TITLE_ROW}>
        <h2 className={CALENDAR_TITLE}>Kalendár aktivít</h2>

        <div className={[CALENDAR_NAV_ROW, CALENDAR_NAV_NUDGE].join(" ")}>
          <Button
            variant="ghost"
            size="sm"
            circle
            aria-label="Predchádzajúci mesiac"
            onClick={() => jump(-1)}
          >
            ‹
          </Button>

          <div className={CALENDAR_MONTH_LABEL}>{label}</div>

          <Button
            variant="ghost"
            size="sm"
            circle
            aria-label="Nasledujúci mesiac"
            onClick={() => jump(1)}
          >
            ›
          </Button>
        </div>
      </div>

      {/* legenda */}
      <div className={CALENDAR_LEGEND_WRAP}>
        <div className={CALENDAR_LEGEND_ITEM}>
          <span
            className={CALENDAR_LEGEND_DOT}
            style={{ backgroundColor: THEME.chart.other }}
          />
          <span>external</span>
        </div>

        <div className={CALENDAR_LEGEND_ITEM}>
          <span
            className={CALENDAR_LEGEND_DOT}
            style={{ backgroundColor: THEME.chart.run }}
          />
          <span>aktivita</span>
        </div>

        <div className={CALENDAR_LEGEND_ITEM}>
          <span
            className={[CALENDAR_LEGEND_DOT, "border"].join(" ")}
            style={{
              borderColor: THEME.chart.run,
              backgroundColor: "transparent",
            }}
          />
          <span>plán</span>
        </div>

        <div className={CALENDAR_LEGEND_ITEM}>
          <span className={CALENDAR_LEGEND_TINY} style={{ color: THEME.chart.run }}>
            ✓
          </span>
          <span>splnený plán</span>
        </div>

        <div className={CALENDAR_LEGEND_ITEM}>
          <span className={CALENDAR_LEGEND_TINY} style={{ color: THEME.chart.run }}>
            ×
          </span>
          <span>missed plán</span>
        </div>
      </div>

      {externals.err && <div className={CALENDAR_ERROR_LINE}>{externals.err}</div>}

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
        externalRows={selectedExternalRows}
        safeSportKey={safeSportKey}
        actMap={actMap}
      />
    )}
  </div>
);
}
