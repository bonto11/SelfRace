"use client";

import React from "react";
import CalendarMonth, { CalActivity } from "@/shared/components/CalendarMonth";
import { useActivityData, ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivityDetailOverlay from "@/shared/components/ActivityDetailOverlay";

/** Pomocná utilita: Y-M prvý / posledný deň v ISO */
function monthBounds(year: number, month1to12: number) {
  const from = new Date(year, month1to12 - 1, 1);
  const to = new Date(year, month1to12, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { startIso: iso(from), endIso: iso(to) };
}

/** Bezpečné vyčítanie dátumu z aktivity (podľa toho, čo máš v provideri) */
function pickDateIso(a: any): string | null {
  // preferuj "start_time" (ISO) -> YYYY-MM-DD
  if (typeof a?.start_time === "string" && a.start_time.length >= 10) return a.start_time.slice(0, 10);
  // fallbacky (ak by boli inde)
  if (typeof a?.date === "string" && a.date.length >= 10) return a.date.slice(0, 10);
  if (typeof a?.start_date === "string" && a.start_date.length >= 10) return a.start_date.slice(0, 10);
  return null;
}

function useMonthActivities(year: number, month: number) {
  const { listBetween } = useActivityData();
  const [map, setMap] = React.useState<Record<string, CalActivity[]>>({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { startIso, endIso } = monthBounds(year, month);
        // očakávame, že provider má listBetween(start,end)
        // ak nie, zober si všetky a prefiltrovať tu
        const rows: any[] = await listBetween?.(startIso, endIso) ?? [];
        const next: Record<string, CalActivity[]> = {};
        for (const r of rows) {
          const d = pickDateIso(r);
          if (!d) continue;
          const id = Number((r as any).id ?? (r as any).activity_id);
          const name = String((r as any).name ?? (r as any).activity_name ?? "Activity");
          const item: CalActivity = { id, name, date: d };
          (next[d] ||= []).push(item);
        }
        if (alive) setMap(next);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [year, month, listBetween]);

  return { itemsByDay: map, loading };
}

/** Public: vlož do stránky – má aj svoj ActivityDataProvider */
export default function ActivitiesCalendarCard() {
  const today = new Date();
  const [y, setY] = React.useState(today.getFullYear());
  const [m, setM] = React.useState(today.getMonth() + 1); // 1-12
  const [openId, setOpenId] = React.useState<number | null>(null);

  return (
    <ActivityDataProvider days={120}>
      <InnerCalendar
        year={y}
        month={m}
        setYear={setY}
        setMonth={setM}
        openId={openId}
        setOpenId={setOpenId}
      />
    </ActivityDataProvider>
  );
}

function InnerCalendar({
  year, month, setYear, setMonth,
  openId, setOpenId,
}: {
  year: number; month: number;
  setYear: (n: number) => void; setMonth: (n: number) => void;
  openId: number | null; setOpenId: (n: number | null) => void;
}) {
  const { itemsByDay } = useMonthActivities(year, month);

  const prev = () => {
    const d = new Date(year, month - 2, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };
  const next = () => {
    const d = new Date(year, month, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };

  return (
    <>
      <CalendarMonth
        year={year}
        month={month}
        itemsByDay={itemsByDay}
        onPrevMonth={prev}
        onNextMonth={next}
        onOpenActivity={(id) => setOpenId(id)}
      />

      {openId != null && (
        <ActivityDetailOverlay
          activityId={openId}
          open
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}