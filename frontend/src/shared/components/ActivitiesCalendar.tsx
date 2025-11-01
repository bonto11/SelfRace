"use client";

import React from "react";
import CalendarMonth, { CalActivity } from "@/shared/components/CalendarMonth";
import {
  ActivityDataProvider,
  useActivityData,
} from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivityDetailOverlay from "@/shared/components/ActivityDetailOverlay";

/* --- helpers --- */
function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function monthBounds(year: number, month1to12: number) {
  const from = new Date(year, month1to12 - 1, 1);
  const to = new Date(year, month1to12, 0);
  return { startIso: ymd(from), endIso: ymd(to) };
}

/** Vyrob mapu aktivít pre daný mesiac z provider.rows */
function useMonthMap(year: number, month: number) {
  const { rows } = useActivityData();
  return React.useMemo(() => {
    const { startIso, endIso } = monthBounds(year, month);
    const map: Record<string, CalActivity[]> = {};
    for (const r of rows) {
      // ActivityRow má .date (YYYY-MM-DD), .activity_id, .name
      const d = r.date?.slice(0, 10);
      if (!d || d < startIso || d > endIso) continue;
      const id = Number((r as any).activity_id ?? (r as any).id);
      const name =
        (r as any).name ??
        (r as any).title ??
        (r as any).activity_name ??
        "Activity";
      (map[d] ||= []).push({ id, name: String(name), date: d });
    }
    return map;
  }, [rows, year, month]);
}

/* Public wrapper – dá vlastný provider s väčším rozsahom (napr. 400 dní) */
export default function ActivitiesCalendarCard() {
  const today = new Date();
  return (
    <ActivityDataProvider days={400}>
      <Inner y0={today.getFullYear()} m0={today.getMonth() + 1} />
    </ActivityDataProvider>
  );
}

function Inner({ y0, m0 }: { y0: number; m0: number }) {
  const [y, setY] = React.useState(y0);
  const [m, setM] = React.useState(m0); // 1..12
  const [openId, setOpenId] = React.useState<number | null>(null);

  const itemsByDay = useMonthMap(y, m);

  const prev = () => {
    const d = new Date(y, m - 2, 1);
    setY(d.getFullYear());
    setM(d.getMonth() + 1);
  };
  const next = () => {
    const d = new Date(y, m, 1);
    setY(d.getFullYear());
    setM(d.getMonth() + 1);
  };

  return (
    <>
      <CalendarMonth
        year={y}
        month={m}
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