// src/features/coach/components/PlanActive.tsx
"use client";

import * as React from "react";

import { CARD } from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import PlanSingle, {
  type PlanStatus,
} from "@/shared/components/PlanSingle";

type AnyObj = Record<string, any>;

/* ───────── helpers ───────── */

function hrToText(hr?: any): string | null {
  if (!hr) return null;
  if (
    Array.isArray(hr) &&
    hr.length === 2 &&
    hr.every((x) => Number.isFinite(x))
  ) {
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
  const hr = sess?.target_hr_bpm_range ?? sess?.target_hr ?? null;
  const pace = sess?.target_pace_min_per_km ?? null;
  const pow = sess?.target_power_watts ?? null;

  const mainT = Array.isArray(sess?.structure?.main)
    ? sess.structure.main[0]?.target
    : sess?.structure?.main?.target;

  const hr2 = hr ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2 = pow ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(
    Boolean,
  );
  return parts.length ? parts.join(" · ") : null;
}

function intervalsToText(main: any): string | null {
  const arr = Array.isArray(main)
    ? main
    : main && Array.isArray(main.sets)
      ? main.sets
      : null;
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
  return (
    trainingDef?.label ??
    sess?.title ??
    sess?.name ??
    row?.title ??
    "Tréning"
  );
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
        sess.structure.warmup?.notes
          ? `WU: ${sess.structure.warmup.notes}`
          : null,
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
        sess.structure.cooldown?.notes
          ? `CD: ${sess.structure.cooldown.notes}`
          : null,
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
    sess.title || sess.session_type || row.title || row.session_type || "",
  );

  if (sport === "other") return true;
  if (duration === 0) return true;
  if (/rest|volno|off day/i.test(title)) return true;
  return false;
}

// vygeneruje pole dní [from, to] vrátane
function buildDayRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso;
  while (cur <= toIso) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/* ───────── hlavný komponent ───────── */

export default function PlanActive() {
  const { rows: planRows } = usePlanData();

  const today = todayISO();
  const from = addDays(today, -5);
  const to = addDays(today, 10);

  console.log("[PlanActive] render", {
    planRowsLength: planRows.length,
    from,
    to,
    sampleRow: planRows[0],
  });

  // group by day (len aktuálne okno)
  const byDay = React.useMemo(() => {
    const map = new Map<string, { row: AnyObj; sess: AnyObj }[]>();

    for (const r of planRows) {
      if (!r) continue;
      const dIso = String((r as any).plan_date).slice(0, 10);
      if (!dIso) continue;
      if (dIso < from || dIso > to) continue;

      const sess: AnyObj = (r as any).payload ?? r;
      if (isRestSession(r, sess)) continue;

      const arr = map.get(dIso) ?? [];
      arr.push({ row: r as AnyObj, sess });
      map.set(dIso, arr);
    }

    // sort podľa session_index
    for (const [day, list] of map.entries()) {
      list.sort(
        (a, b) =>
          (a.row.session_index ?? 0) - (b.row.session_index ?? 0),
      );
    }

    const keys = Array.from(map.keys()).sort();
    const totalSessions = keys.reduce(
      (acc, k) => acc + (map.get(k)?.length ?? 0),
      0,
    );
    console.log("[PlanActive] byDay built", { keys, totalSessions });

    return map;
  }, [planRows, from, to]);

  const days = React.useMemo(() => {
    const d = buildDayRange(from, to);
    console.log("[PlanActive] days built", {
      count: d.length,
      first: d[0],
      last: d[d.length - 1],
    });
    return d;
  }, [from, to]);

  if (!planRows.length) {
    return (
      <section className={[CARD, "p-3 md:p-4"].join(" ")}>
        <h2 className="text-lg font-bold mb-1">Aktívny plán — prehľad</h2>
        <p className="text-sm opacity-70">
          Zatiaľ nemáš uložený žiadny aktívny plán.
        </p>
      </section>
    );
  }

  return (
    <section className={[CARD, "p-3 md:p-4 space-y-3"].join(" ")}>
      <h2 className="text-lg font-bold">
        Aktívny plán — prehľad{" "}
        <span className="text-xs font-normal opacity-70">
          (read-only debug verzia; žiadne úpravy)
        </span>
      </h2>

      <ul className="space-y-2">
        {days.map((dayIso) => {
          const list = byDay.get(dayIso) ?? [];

          // žiadny tréning v daný deň → jedna prázdna karta
          if (!list.length) {
            const pseudoId = Number(dayIso.replace(/-/g, "")) || 0;
            return (
              <li key={dayIso}>
                <PlanSingle
                  id={pseudoId}
                  title="Žiadny tréning"
                  dateIso={dayIso}
                  sport="other"
                  status={"planned" satisfies PlanStatus}
                  planDur={null}
                  planIntensity={null}
                  planTarget={null}
                  planNotes={null}
                  activitySummary={null}
                />
              </li>
            );
          }

          // sú tréningy → 1 karta na 1 session
          return list.map(({ row, sess }, idx) => {
            const sport = (row as any).sport || detectSport(sess) || "other";
            const title = normTitle(row, sess);
            const planDur = normDuration(row, sess);
            const planInt = normIntensity(row, sess);
            const target = normTarget(sess);
            const notes = normNotes(sess);

            // zatiaľ neprepájame na aktivity → všetko “planned”
            const status: PlanStatus = "planned";

            return (
              <li key={`${dayIso}-${row.id ?? idx}`}>
                <PlanSingle
                  id={Number(row.id) || idx}
                  title={title}
                  dateIso={dayIso}
                  sport={sport}
                  status={status}
                  planDur={planDur}
                  planIntensity={planInt}
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