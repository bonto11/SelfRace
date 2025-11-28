// src/features/coach/components/PlanActive.tsx
"use client";

import * as React from "react";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { CARD, SURFACE_INLINE } from "@/shared/ui/classes";
import SportBadge from "@/shared/components/ui/SportBadge";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import { detectSport } from "@/features/coach/utils/plan";

type AnyObj = Record<string, any>;

function prettySkDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function isRestSession(row: any, sess: AnyObj): boolean {
  const sport = (row as any).sport || detectSport(sess) || "other";
  const duration = sess.duration_min ?? row.duration_min ?? null;
  const title = String(
    sess.title || sess.session_type || row.title || row.session_type || ""
  );

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

function normTitle(row: AnyObj, sess: AnyObj) {
  const t =
    sess?.title ??
    sess?.name ??
    row?.title ??
    row?.session_type ??
    "Tréning";
  return t;
}

function normDuration(row: AnyObj, sess: AnyObj) {
  const minutes =
    (typeof sess?.duration_min === "number" && sess.duration_min) ??
    (typeof row?.duration_min === "number" && row.duration_min) ??
    null;
  return minutes != null ? `${minutes} min` : null;
}

function normIntensity(row: AnyObj, sess: AnyObj) {
  return sess?.intensity ?? row?.intensity ?? null;
}

export default function PlanActive() {
  const { planRows } = usePlanData();

  const today = todayISO();
  const fromIso = addDays(today, -5);
  const toIso = addDays(today, 10);

  // log len raz pri renderi
  console.log("[PlanActive] render", {
    planRowsLength: planRows.length,
    from: fromIso,
    to: toIso,
    sampleRow: planRows[0],
  });

  // rozdelíme riadky podľa dňa v danom rozsahu
  const byDay = React.useMemo(() => {
    const map: Record<string, AnyObj[]> = {};

    for (const r of planRows) {
      const dIso = String(r.plan_date).slice(0, 10);

      // filter na rozsah
      if (dIso < fromIso || dIso > toIso) continue;

      const sess: AnyObj = (r as any).payload ?? r;
      if (isRestSession(r, sess)) continue;

      if (!map[dIso]) map[dIso] = [];
      map[dIso].push(r);
    }

    const totalSessions = Object.values(map).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    console.log("[PlanActive] byDay built", {
      keys: Object.keys(map),
      totalSessions,
    });

    return map;
  }, [planRows, fromIso, toIso]);

  // lineárny zoznam dní v rozsahu (dnes - 5 až dnes + 10)
  const days: string[] = React.useMemo(() => {
    const out: string[] = [];
    let cur = fromIso;
    while (cur <= toIso) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    console.log("[PlanActive] days built", {
      count: out.length,
      first: out[0],
      last: out[out.length - 1],
    });
    return out;
  }, [fromIso, toIso]);

  return (
    <section className={[CARD, "p-3 md:p-4 space-y-3"].join(" ")}>
      <div>
        <h2 className="text-lg font-bold">
          Aktívny plán — prehľad
        </h2>
        <p className="text-xs opacity-60">
          Read-only náhľad z DB (žiadne úpravy, len pre kontrolu).
        </p>
      </div>

      <div className="space-y-2">
        {days.map((dIso) => {
          const dayRows = byDay[dIso] ?? [];
          const isToday = dIso === today;

          return (
            <div
              key={dIso}
              className={[
                "rounded-2xl border border-white/10 bg-white/5",
                "px-3 py-2 space-y-1",
                isToday ? "ring-1 ring-emerald-500/60" : "",
              ].join(" ")}
            >
              {/* header dňa */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                  {prettySkDate(dIso)}
                </div>
                {isToday && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                    Today
                  </span>
                )}
              </div>

              {/* obsah dňa */}
              {dayRows.length === 0 && (
                <div className="text-xs opacity-70">Žiadny tréning</div>
              )}

              {dayRows.length > 0 && (
                <ul className="space-y-1">
                  {dayRows.map((row: AnyObj) => {
                    const sess: AnyObj = row.payload ?? row;
                    const sport =
                      row.sport || detectSport(sess) || "other";
                    const title = normTitle(row, sess);
                    const dur = normDuration(row, sess);
                    const intensity = normIntensity(row, sess);

                    return (
                      <li key={row.id}>
                        <div
                          className={[
                            SURFACE_INLINE,
                            "px-3 py-2 flex items-center justify-between gap-2",
                          ].join(" ")}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="text-sm font-semibold">
                              {title}
                            </div>
                            <div className="text-[11px] opacity-80 flex gap-1 flex-wrap">
                              {dur && <span>{dur}</span>}
                              {intensity && <span>· {intensity}</span>}
                            </div>
                          </div>
                          <SportBadge sport={sport} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}