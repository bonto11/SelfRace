// src/shared/components/widgets/WidgetActivitiesCalendar.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import { CALENDAR_DAY_CELL, NO_X_OVERFLOW } from "@/app/shared/ui/classes";
import { THEME } from "@/app/shared/theme/tokens";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

import { apiGetExternalEventsWindow } from "@/app/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";

import {
  dedupeCalendarItems,
  eventDateIso,
  type CalendarItemBase,
  type CalendarItemKind,
} from "@/app/features/calendar/utils/calendarSlots";
import type { SportKey } from "@/app/features/calendar/types/calendarTypes";

/* ---------- helpers ---------- */

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

function safeSportKey(v: any): SportKey {
  const s = String(v || "").toLowerCase() as SportKey;
  if (s in SPORT_COLORS) return s;
  return "other";
}

type DayItem = CalendarItemBase & {
  id: number;
};

type Props = {
  openHref?: string; // default /calendar
  perDayLimit?: number;
};

/* ---------- component ---------- */

export default function WidgetActivitiesCalendar({
  openHref = "/calendar",
  perDayLimit = 6,
}: Props) {
  const router = useRouter();
  const { userId } = useUserId();
  const { selectByRange } = useActivityData();

  // NOVÉ: plán z CoachDataProvideru
  const { plan } = useCoachData();
  const { selectPlanByRange } = plan;

  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = iso(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate()
  );
  const endIso = iso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  const [externalRows, setExternalRows] = React.useState<ExternalEvent[]>([]);
  const [extErr, setExtErr] = React.useState<string | null>(null);

  // načítanie externals pre týždeň
  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setExtErr(null);
      try {
        const rows = await apiGetExternalEventsWindow(userId, startIso, endIso);
        if (!alive) return;
        setExternalRows(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (!alive) return;
        setExternalRows([]);
        setExtErr(e?.message ?? "Failed to load external events.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, startIso, endIso]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const todayIso = new Date().toISOString().slice(0, 10);

    // init 7 dní
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
      map.set(key, []);
    }

    // externals
    for (const ev of externalRows) {
      const k = eventDateIso(ev);
      if (!k || !map.has(k)) continue;

      const sport = safeSportKey(
        (ev as any).sport ?? (ev as any).sport_type ?? "other"
      );

      map.get(k)!.push({
        id: Number(ev.id ?? 0) || Math.floor(Math.random() * 1e9),
        sport,
        kind: "external",
        activityId: null,
      });
    }

    // reálne aktivity
    const actRows = selectByRange(startIso, endIso);
    for (const r of actRows as any[]) {
      const k = String(r.date ?? "").slice(0, 10);
      if (!k || !map.has(k)) continue;

      const sport = safeSportKey(
        r.sport ?? r.sport_type_fe ?? r.sport_type ?? "other"
      );
      const aidRaw = r.activity_id;
      const activityId =
        aidRaw != null && !Number.isNaN(Number(aidRaw)) ? Number(aidRaw) : null;

      map.get(k)!.push({
        id: activityId ?? Math.floor(Math.random() * 1e9),
        sport,
        kind: "activity",
        activityId,
      });
    }

    // plán (bez REST) + prepojenie na aktivity, vrátane missed/done
    const planRows = selectPlanByRange(startIso, endIso);
    for (const p of planRows as any[]) {
      const k = String(p.plan_date ?? "").slice(0, 10);
      if (!k || !map.has(k)) continue;

      const title = String(p.title || "").toLowerCase();
      const sType = String(p.session_type || "").toLowerCase();
      const sport = safeSportKey(p.sport || "other");
      const duration = p.duration_min ?? null;

      const isRest =
        sType === "rest" ||
        title.startsWith("rest") ||
        sport === "other" ||
        duration === 0;

      const arr = map.get(k)!;

      const actIdRaw = (p as any).activity_id;
      const activityId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw))
          ? Number(actIdRaw)
          : null;

      if (activityId) {
        const idx = arr.findIndex(
          (it) => it.kind === "activity" && it.activityId === activityId
        );
        if (idx >= 0) {
          arr[idx] = {
            ...arr[idx],
            kind: "done",
            activityId,
          };
          continue;
        }
      }

      if (!isRest) {
        const isPast = k < todayIso;
        const kind: CalendarItemKind = isPast ? "missed" : "plan";

        arr.push({
          id: Number(p.id),
          sport,
          kind,
          activityId: activityId ?? null,
        });
      }
    }

    for (const [key, arr] of map.entries()) {
      map.set(key, dedupeCalendarItems<DayItem>(arr));
    }

    return map;
  }, [
    monday,
    startIso,
    endIso,
    selectByRange,
    selectPlanByRange,
    externalRows,
  ]);

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
      {extErr && (
        <div className="mb-2 text-[11px] text-red-300 line-clamp-2">
          {extErr}
        </div>
      )}

      <div className="grid grid-cols-7 gap-2 text-[11px] uppercase tracking-wide opacity-70 mb-2">
        {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-2 cursor-pointer"
        onClick={handleOpen}
        aria-label="otvoriť kalendár"
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);

          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const items = byDay.get(key) ?? [];
          const shown = items.slice(0, perDayLimit);

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
                  {shown.map((it) => {
                    const color =
                      SPORT_COLORS[String(it.sport)] ?? SPORT_COLORS.other;

                    if (it.kind === "activity" || it.kind === "external") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      );
                    }

                    if (it.kind === "plan") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className="inline-block w-1.5 h-1.5 rounded-full border"
                          style={{
                            borderColor: color,
                            backgroundColor: "transparent",
                          }}
                        />
                      );
                    }

                    if (it.kind === "done") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className="inline-flex items-center justify-center w-3 h-3 text-[9px] leading-none"
                          style={{ color }}
                        >
                          ✓
                        </span>
                      );
                    }

                    // missed
                    return (
                      <span
                        key={`${it.kind}-${it.id}`}
                        className="inline-flex items-center justify-center w-3 h-3 text-[9px] leading-none"
                        style={{ color }}
                      >
                        ✕
                      </span>
                    );
                  })}

                  {items.length > shown.length && (
                    <span className="text-[10px] opacity-70">
                      +{items.length - shown.length}
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
