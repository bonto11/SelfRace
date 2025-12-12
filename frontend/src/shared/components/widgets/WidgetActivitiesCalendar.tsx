"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { THEME } from "@/shared/theme/tokens";
import { CALENDAR_DAY_CELL, NO_X_OVERFLOW } from "@/shared/ui/classes";

import { useUserId } from "@/shared/hooks/useUserId";
import { apiGetExternalEventsWindow } from "@/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";

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

function safeSportKey(v: any): string {
  const s = String(v || "").toLowerCase();
  if (s in SPORT_COLORS) return s;
  return "other";
}

type DayItem = {
  id: number;
  sport: string;
  kind: "activity" | "external" | "plan" | "done" | "missed";
};

type Props = {
  openHref?: string; // default /calendar
  perDayLimit?: number;
};

export default function WidgetWeekActivities({
  openHref = "/calendar",
  perDayLimit = 6,
}: Props) {
  const router = useRouter();
  const { selectByRange } = useActivityData();
  const { selectPlanByRange } = usePlanData();
  const { userId } = useUserId();

  const monday = startOfWeek();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startIso = iso(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const endIso = iso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  const [externalRows, setExternalRows] = React.useState<ExternalEvent[]>([]);
  const [extErr, setExtErr] = React.useState<string | null>(null);

  // fetch externals pre týždeň
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
      map.set(iso(d.getFullYear(), d.getMonth(), d.getDate()), []);
    }

    // externals (už expandované cez occurrence_date)
    for (const ev of externalRows) {
      const k = String((ev as any).occurrence_date || ev.single_date || "")
        .slice(0, 10)
        .trim();
      if (!k || !map.has(k)) continue;

      map.get(k)!.push({
        id: Number(ev.id ?? 0) || Math.floor(Math.random() * 1e9),
        sport: safeSportKey(ev.sport),
        kind: "external",
      });
    }

    // reálne aktivity
    const actRows = selectByRange(startIso, endIso);
    for (const r of actRows) {
      const k = r.date.slice(0, 10);
      if (!map.has(k)) continue;
      map.get(k)!.push({
        id: r.activity_id,
        sport: safeSportKey((r as any).sport || (r as any).sport_type_fe || "other"),
        kind: "activity",
      });
    }

    // plán (bez REST) + prepojenie na aktivity, vrátane missed
    const planRows = selectPlanByRange(startIso, endIso);
    for (const p of planRows) {
      const k = String(p.plan_date).slice(0, 10);
      if (!map.has(k)) continue;

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
      const actId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw))
          ? Number(actIdRaw)
          : null;

      // ak má activity_id → označ activity ako done
      if (actId) {
        const idx = arr.findIndex((it) => it.kind === "activity" && it.id === actId);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], kind: "done" };
          continue;
        }
      }

      if (!isRest) {
        const isPast = k < todayIso;
        arr.push({
          id: p.id,
          sport,
          kind: isPast ? "missed" : "plan",
        });
      }
    }

    // DEDUPE: ak existuje activity (alebo done) pre šport S → vyhoď external + plan/missed pre S
    for (const [k, arr] of map.entries()) {
      const hasActivitySport = new Set(
        arr
          .filter((x) => x.kind === "activity" || x.kind === "done")
          .map((x) => x.sport)
      );

      if (hasActivitySport.size === 0) continue;

      map.set(
        k,
        arr.filter((x) => {
          if (x.kind === "plan" || x.kind === "missed" || x.kind === "external") {
            return !hasActivitySport.has(x.sport);
          }
          return true;
        })
      );
    }

    return map;
  }, [monday, startIso, endIso, selectByRange, selectPlanByRange, externalRows]);

  const weekLabel =
    `${monday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })} – ` +
    `${sunday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })}`;

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
        <div className="mb-2 text-[11px] text-red-300 line-clamp-2">{extErr}</div>
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
                    const color = SPORT_COLORS[it.sport] ?? SPORT_COLORS.other;

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