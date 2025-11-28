// src/features/coach/components/PlanActive.tsx
"use client";

import * as React from "react";

import { CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import PlanSingle, { type PlanStatus } from "@/shared/components/PlanSingle";

type AnyObj = Record<string, any>;

/* -------------------- malé helpery -------------------- */

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

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (Array.isArray(hr) && hr.length === 2 && hr.every((x) => Number.isFinite(x))) {
    return `HR ${hr[0]}–${hr[1]}`;
  }
  return null;
}

function paceToText(p?: any): string | null {
  return typeof p === "string" && p.trim() ? `pace ${p}` : null;
}

function powerToText(w?: any): string | null {
  return Number.isFinite(w) ? `power ${w}W` : null;
}

function normTarget(sess: AnyObj): string | null {
  const hr   = sess?.target_hr_bpm_range ?? sess?.target_hr ?? null;
  const pace = sess?.target_pace_min_per_km ?? null;
  const pow  = sess?.target_power_watts ?? null;

  const mainT = Array.isArray(sess?.structure?.main)
    ? sess.structure.main[0]?.target
    : sess?.structure?.main?.target;

  const hr2   = hr   ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2  = pow  ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function intervalsToText(main: any): string | null {
  const arr =
    Array.isArray(main) ? main :
    main && Array.isArray(main.sets) ? main.sets :
    null;

  if (!arr || !arr.length) return null;

  const first = arr[0];
  const reps = Number.isFinite(first?.reps) ? `${first.reps}×` : "";
  const work = Number.isFinite(first?.work_min) ? `${first.work_min}′` : "";
  const rec =
    Number.isFinite(first?.recover_min) && first.recover_min > 0
      ? ` / ${first.recover_min}′ rec`
      : "";
  const targ = first?.target
    ? [
        hrToText(first.target.hr),
        paceToText(first.target.pace),
        powerToText(first.target.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const txt = [reps && work ? `${reps}${work}` : work || reps, rec, targ]
    .filter(Boolean)
    .join(" ");
  return txt || null;
}

function normTitle(row: AnyObj, sess: AnyObj) {
  const sessionTypeId =
    typeof sess?.session_type === "string"
      ? sess.session_type
      : typeof row.session_type === "string"
      ? row.session_type
      : null;

  const trainingDef = sessionTypeId ? findTrainingTypeById(sessionTypeId) : null;
  return trainingDef?.label ?? sess?.title ?? sess?.name ?? row?.title ?? "Tréning";
}

function normDuration(row: AnyObj, sess: AnyObj) {
  const minutes =
    (typeof sess?.duration_min === "number" && sess.duration_min) ??
    (typeof row?.duration_min === "number" && row.duration_min) ??
    (typeof sess?.dur === "number" && sess.dur) ??
    null;
  return minutes != null ? `${minutes} min` : null;
}

function normIntensity(row: AnyObj, sess: AnyObj) {
  return sess?.intensity ?? row?.intensity ?? null;
}

function normNotes(sess: AnyObj) {
  if (sess?.notes) return sess.notes;

  const wu = sess?.structure?.warmup
    ? [
        sess.structure.warmup?.notes ? `WU: ${sess.structure.warmup.notes}` : null,
        hrToText(sess.structure.warmup?.target?.hr),
        paceToText(sess.structure.warmup?.target?.pace),
        powerToText(sess.structure.warmup?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const main = sess?.structure?.main ? intervalsToText(sess.structure.main) : "";

  const cd = sess?.structure?.cooldown
    ? [
        sess.structure.cooldown?.notes ? `CD: ${sess.structure.cooldown.notes}` : null,
        hrToText(sess.structure.cooldown?.target?.hr),
        paceToText(sess.structure.cooldown?.target?.pace),
        powerToText(sess.structure.cooldown?.target?.power),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const ex =
    Array.isArray(sess?.exercises) && sess.exercises.length
      ? "Exercises: " +
        sess.exercises
          .map((e: any) => {
            const parts = [e?.name, e?.sets ? `${e.sets}x` : ""];
            if (e?.seconds) parts.push(`${e.seconds}s`);
            else if (e?.reps) parts.push(`${e.reps}`);
            return parts.filter(Boolean).join(" ");
          })
          .join(", ")
      : "";

  const parts = [wu, main, cd, ex].filter(Boolean);
  return parts.length ? parts.join(" • ") : null;
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

/* ---------------------- hlavný komponent ---------------------- */

export default function PlanActive() {
  const { planRows } = usePlanData();

  // základný log pri každom rendri
  const today = todayISO();
  const from = addDays(today, -5);
  const to = addDays(today, 10);

  console.log("[PlanActive] render", {
    planRowsLength: planRows.length,
    from,
    to,
    sampleRow: planRows[0] ?? null,
  });

  // ak nič v pláne, nerenederuj kartu
  if (!planRows.length) {
    console.log("[PlanActive] no planRows → return null");
    return null;
  }

  // zoznam dní (lineárne, žiadne efekty)
  const days: string[] = React.useMemo(() => {
    const out: string[] = [];
    let cur = from;
    let safety = 0;
    while (cur <= to && safety < 60) {
      out.push(cur);
      cur = addDays(cur, 1);
      safety += 1;
    }
    console.log("[PlanActive] days built", { count: out.length, first: out[0], last: out[out.length - 1] });
    return out;
  }, [from, to]);

  // mapovanie: day → sessions
  const byDay = React.useMemo(() => {
    const map: Record<string, AnyObj[]> = {};
    for (const r of planRows) {
      const dIso = String((r as any).plan_date).slice(0, 10);
      if (dIso < from || dIso > to) continue;

      const sess: AnyObj = (r as any).payload ?? r;
      if (isRestSession(r, sess)) continue;

      if (!map[dIso]) map[dIso] = [];
      map[dIso].push({ row: r, sess });
    }

    // sort podľa session_index
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => {
        const ia = (a.row as any).session_index ?? 0;
        const ib = (b.row as any).session_index ?? 0;
        return ia - ib;
      });
    });

    console.log("[PlanActive] byDay built", {
      keys: Object.keys(map),
      totalSessions: Object.values(map).reduce((s, arr) => s + arr.length, 0),
    });

    return map;
  }, [planRows, from, to]);

  return (
    <section
      className={[CARD, "p-3 md:p-4 space-y-3", NO_X_OVERFLOW].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Aktívny plán — prehľad</h2>
        <span className="text-xs opacity-70">
          (read-only debug verzia; žiadne úpravy, len náhľad)
        </span>
      </div>

      <ul className="space-y-3">
        {days.map((dIso) => {
          const list = byDay[dIso] ?? [];

          // log pre každý deň – ale len pri prvom rendri (pomocný guard)
          if (list.length > 0) {
            console.log("[PlanActive] day", dIso, {
              pretty: prettySkDate(dIso),
              count: list.length,
            });
          }

          if (!list.length) {
            // deň bez tréningu – jednoduchý stub
            return (
              <li key={dIso}>
                <div className="px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
                  <div className="text-[11px] uppercase opacity-70 mb-1">
                    {prettySkDate(dIso)}
                  </div>
                  <div className="text-sm opacity-70">Žiadny tréning</div>
                </div>
              </li>
            );
          }

          return list.map((item, idx) => {
            const row = item.row;
            const sess = item.sess;
            const sport = (row as any).sport || detectSport(sess) || "other";

            const title = normTitle(row, sess);
            const dur = normDuration(row, sess);
            const intensity = normIntensity(row, sess);
            const target = normTarget(sess);
            const notes = normNotes(sess);

            const status: PlanStatus = "planned"; // zatiaľ neriešim done/missed

            return (
              <li key={`${dIso}-${(row as any).id ?? idx}`} className="px-0">
                <PlanSingle
                  id={(row as any).id ?? idx}
                  title={title}
                  dateIso={dIso}
                  sport={sport}
                  status={status}
                  planDur={dur}
                  planIntensity={intensity}
                  planTarget={target}
                  planNotes={notes}
                  activitySummary={null}
                />
              </li>
            );
          });
        })}
      </ul>
    </section>
  );
}