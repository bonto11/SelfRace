"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";

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
const iso = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Po=0..Ne=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

type Props = {
  openHref?: string;   // default /calendar
  perDayLimit?: number;
};

export default function WidgetWeekActivities({ openHref = "/calendar", perDayLimit = 6 }: Props) {
  const router = useRouter();
  const { selectByRange } = useActivityData();

  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = iso(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const endIso   = iso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  const byDay = React.useMemo(() => {
    const map = new Map<string, { id: number; sport: string }[]>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      map.set(iso(d.getFullYear(), d.getMonth(), d.getDate()), []);
    }
    const rows = selectByRange(startIso, endIso);
    for (const r of rows) {
      const k = r.date.slice(0, 10);
      if (!map.has(k)) continue;
      (map.get(k) as any[]).push({
        id: r.activity_id,
        sport: (r as any).sport || (r as any).sport_type_fe || "other",
      });
    }
    return map;
  }, [selectByRange, startIso, endIso]);

  const weekLabel =
    `${monday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })} – ` +
    `${sunday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })}`;

  const handleOpen = () => router.push(openHref);

  return (
    <WidgetCard
      title={`Týždenná agenda • ${weekLabel}`}
      onOpen={handleOpen}
      interactive
      accent="bg-slate-700"
      minH={160}
    >
      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2">
        {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => (
          <div key={d} className="text-center">{d}</div>
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

          const key   = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const items = byDay.get(key) ?? [];
          const shown = items.slice(0, perDayLimit);

          const isToday = new Date().toDateString() === d.toDateString();

          return (
            <div
              key={key}
              className={[
                "rounded-2xl border border-white/10 bg-white/5 dark:bg-black/20",
                "px-2 py-1.5 select-none min-h-[64px]", // vyššie: miesto na číslo + doty
                isToday ? "ring-2 ring-emerald-500/60" : "",
              ].join(" ")}
            >
              {/* NOVÝ LAYOUT: stĺpec – číslo hore vľavo, doty pod ním */}
              <div className="flex flex-col">
                {/* Číslo dňa bez akéhokoľvek pozadia / chipu */}
                <span
                  className="day-num text-sm font-semibold leading-none tracking-tight ml-0.5 mt-0.5"
                  style={{ background: "transparent", borderRadius: 0, boxShadow: "none" }}
                >
                  {d.getDate()}
                </span>

                {/* Sport doty pod číslom; wrap keď je ich viac */}
                <div className="mt-1.5 pl-0.5 pr-0.5 flex flex-wrap gap-1 items-center">
                  {shown.map((it) => (
                    <span
                      key={it.id}
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: SPORT_COLORS[it.sport] ?? SPORT_COLORS.other }}
                    />
                  ))}
                  {items.length > shown.length && (
                    <span className="text-[10px] opacity-70">+{items.length - shown.length}</span>
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