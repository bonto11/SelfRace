"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { THEME } from "@/shared/theme/tokens";
import { CALENDAR_DAY_CELL, NO_X_OVERFLOW } from "@/shared/ui/classes";

const SPORT_COLORS: Record<string, string> = {
  run: (THEME as any)?.sport?.run ?? THEME.chart.run,
  ride: (THEME as any)?.sport?.ride ?? THEME.chart.ride,
  swim: (THEME as any)?.sport?.swim ?? THEME.chart.swim,
  strength: (THEME as any)?.sport?.strength ?? THEME.chart.strength,
  mixed: (THEME as any)?.sport?.mixed ?? THEME.chart.mixed,
  skate: (THEME as any)?.sport?.skate ?? THEME.chart.skate,
  walk: (THEME as any)?.sport?.walk ?? THEME.chart.walk,
  other: (THEME as any)?.sport?.other ?? THEME.chart.other,
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Po=0..Ne=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

type Props = {
  openHref?: string; // default /calendar
  perDayLimit?: number;
};

type DayAgg = {
  activities: { id: number; sport: string }[];
  planned: { id: number; sport: string; hasActivity: boolean }[];
};

export default function WidgetWeekActivities({
  openHref = "/calendar",
  perDayLimit = 6,
}: Props) {
  const router = useRouter();
  const { selectByRange } = useActivityData();
  const { selectPlanByRange } = usePlanData();

  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = iso(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate()
  );
  const endIso = iso(
    sunday.getFullYear(),
    sunday.getMonth(),
    sunday.getDate()
  );

  const byDay = React.useMemo(() => {
    const map = new Map<string, DayAgg>();
    // init 7 dní
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(key, { activities: [], planned: [] });
    }

    // aktivity
    const rows = selectByRange(startIso, endIso);
    for (const r of rows) {
      const k = r.date.slice(0, 10);
      const bucket = map.get(k);
      if (!bucket) continue;
      bucket.activities.push({
        id: r.activity_id,
        sport: (r as any).sport || (r as any).sport_type_fe || "other",
      });
    }

    // plánované sessions
    const planRows = selectPlanByRange(startIso, endIso);
    for (const p of planRows) {
      const k = String(p.plan_date).slice(0, 10);
      const bucket = map.get(k);
      if (!bucket) continue;
      bucket.planned.push({
        id: p.id,
        sport:
          (p as any).sport ||
          (p as any).payload?.sport ||
          (p as any).payload?.session_sport ||
          "other",
        hasActivity: !!(p as any).activity_id,
      });
    }

    return map;
  }, [selectByRange, selectPlanByRange, startIso, endIso, monday]);

  const weekLabel =
    `${monday.toLocaleDateString("sk-SK", {
      month: "short",
      day: "2-digit",
    })} – ` +
    `${sunday.toLocaleDateString("sk-SK", {
      month: "short",
      day: "2-digit",
    })}`;

  const handleOpen = () => router.push(openHref);

  const accent =
    (THEME as any)?.accent?.neutral ??
    (THEME as any)?.accent?.primary ??
    "#64748B";

  return (
    <WidgetCard
      title={`Týždenná agenda • ${weekLabel}`}
      onOpen={handleOpen}
      interactive
      accent={accent}
      minH={160}
      innerClassName={NO_X_OVERFLOW}
    >
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2">
        {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      {/* 7 stĺpcov – klik otvára kalendár */}
      <div
        className="grid grid-cols-7 gap-2 cursor-pointer"
        onClick={handleOpen}
        aria-label="otvoriť kalendár"
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);

          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const bucket = byDay.get(key) ?? { activities: [], planned: [] };
          const actShown = bucket.activities.slice(0, perDayLimit);
          const remainingSlots =
            perDayLimit - actShown.length > 0 ? perDayLimit - actShown.length : 0;
          const planShown = bucket.planned.slice(0, remainingSlots);

          const totalCount = bucket.activities.length + bucket.planned.length;
          const shownCount = actShown.length + planShown.length;

          const isToday = new Date().toDateString() === d.toDateString();

          return (
            <div
              key={key}
              className={[
                CALENDAR_DAY_CELL,
                "px-2 py-1.5 select-none min-h-[64px]",
                isToday ? "ring-2 ring-emerald-500/60" : "",
                "hover:bg-white/10",
              ].join(" ")}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5">
                  {d.getDate()}
                </span>

                <div className="mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
                  {/* reálne aktivity – plné bodky */}
                  {actShown.map((it) => (
                    <span
                      key={`act-${it.id}`}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          SPORT_COLORS[it.sport] ?? SPORT_COLORS.other,
                      }}
                    />
                  ))}

                  {/* plánované sessions – orámované krúžky */}
                  {planShown.map((it) => (
                    <span
                      key={`plan-${it.id}`}
                      className="inline-block w-1.5 h-1.5 rounded-full border border-dashed"
                      style={{
                        borderColor:
                          SPORT_COLORS[it.sport] ?? SPORT_COLORS.other,
                      }}
                    />
                  ))}

                  {totalCount > shownCount && (
                    <span className="text-[10px] opacity-70">
                      +{totalCount - shownCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}