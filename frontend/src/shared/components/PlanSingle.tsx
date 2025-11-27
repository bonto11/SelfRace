"use client";

import * as React from "react";
import { CARD } from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import {
  apiSavePlanReorder,
  type PlanReorderUpdate,
} from "@/features/coach/api/plan";
import PlanSingle, {
  type PlanStatus,
} from "@/shared/components/PlanSingle";

type AnyObj = Record<string, any>;

/* --- helpers (kopírka z PlanTable / starého PlanActive) --- */

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

function normTarget(it: AnyObj): string | null {
  const hr = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow = it?.target_power_watts ?? null;

  const mainT = Array.isArray(it?.structure?.main)
    ? it.structure.main[0]?.target
    : it?.structure?.main?.target;

  const hr2 = hr ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2 = pow ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(
    Boolean
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

/* --- typy pre draft --- */

type DraftByDay = Record<string, any[]>;

type OriginalPos = Record<
  number,
  {
    plan_date: string;
    session_index: number;
  }
>;

/* --- helper na range dní --- */

function buildDayRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const start = new Date(fromIso + "T00:00:00Z");
  const end = new Date(toIso + "T00:00:00Z");

  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ───────────────────── hlavný komponent ───────────────────── */

export default function PlanActive() {
  const { rows, refresh } = usePlanData();

  const [draftByDay, setDraftByDay] = React.useState<DraftByDay>({});
  const [originalPos, setOriginalPos] = React.useState<OriginalPos>({});
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const today = React.useMemo(() => todayISO(), []);
  const from = React.useMemo(() => addDays(today, -5), [today]);
  const to = React.useMemo(() => addDays(today, 10), [today]);

  // len aktívny plán (má plan_id a je od dnes)
  const activeRows = React.useMemo(
    () =>
      rows.filter(
        (r: any) =>
          r.plan_id &&
          String(r.plan_date).slice(0, 10) >= today
      ),
    [rows, today]
  );

  // init draftu z DB
  React.useEffect(() => {
    if (!activeRows.length) {
      setDraftByDay({});
      setOriginalPos({});
      return;
    }

    const byDay: DraftByDay = {};
    const orig: OriginalPos = {};

    for (const r of activeRows) {
      const dIso = String(r.plan_date).slice(0, 10);
      if (dIso < from || dIso > to) continue;

      const sess: AnyObj = (r as any).payload ?? r;
      if (isRestSession(r, sess)) continue;

      if (!byDay[dIso]) byDay[dIso] = [];

      byDay[dIso].push(r);
    }

    Object.keys(byDay).forEach((day) => {
      byDay[day].sort(
        (a: any, b: any) =>
          (a.session_index ?? 0) - (b.session_index ?? 0)
      );
      byDay[day].forEach((r: any, idx: number) => {
        orig[Number(r.id)] = { plan_date: day, session_index: idx };
      });
    });

    setDraftByDay(byDay);
    setOriginalPos(orig);
    setSelectedDay(null);
  }, [activeRows, from, to]);

  const days = React.useMemo(() => buildDayRange(from, to), [from, to]);

  const hasChanges = React.useMemo(() => {
    for (const [dayIso, list] of Object.entries(draftByDay)) {
      list.forEach((r: any, idx) => {
        const o = originalPos[Number(r.id)];
        if (!o) return true;
        if (o.plan_date !== dayIso || o.session_index !== idx) {
          // malá finta – keď nájdeme rozdiel, vraciame true cez closure
          throw true;
        }
      });
    }
    return false;
  }, [draftByDay, originalPos]);

  let changed = false;
  try {
    changed = hasChanges;
  } catch {
    changed = true;
  }

  const handleDayClick = (dayIso: string) => {
    // prvý klik – len označ
    if (!selectedDay || selectedDay === dayIso) {
      setSelectedDay((prev) => (prev === dayIso ? null : dayIso));
      return;
    }

    // máme vybraný iný deň → swap
    const a = selectedDay;
    const b = dayIso;

    setDraftByDay((prev) => {
      const next: DraftByDay = { ...prev };
      const listA = next[a] ?? [];
      const listB = next[b] ?? [];
      next[a] = listB;
      next[b] = listA;

      // reindex
      [a, b].forEach((d) => {
        if (!next[d]) return;
        next[d] = next[d].map((r: any, idx: number) => ({
          ...r,
          session_index: idx,
        }));
      });

      return next;
    });
    setSelectedDay(null);
  };

  const handleReset = () => {
    void refresh(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: PlanReorderUpdate[] = [];

      Object.entries(draftByDay).forEach(([dayIso, list]) => {
        list.forEach((r: any, idx) => {
          const id = Number(r.id);
          const orig = originalPos[id];
          if (!orig || orig.plan_date !== dayIso || orig.session_index !== idx) {
            updates.push({
              id,
              plan_date: dayIso,
              session_index: idx,
            });
          }
        });
      });

      if (!updates.length) {
        setSaving(false);
        return;
      }

      const res = await apiSavePlanReorder(
        (activeRows[0] as any)?.user_id ?? 0,
        updates
      );
      console.log("[PlanActive] savePlanReorder", res, updates);

      if (res.success) {
        await refresh(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={[CARD, "p-3 md:p-4 space-y-4"].join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Aktívny plán — editácia</h2>
        <span className="text-xs opacity-70">
          Klikni na deň A a potom na deň B, tréningy sa medzi sebou vymenia.
        </span>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-full border border-white/20 bg-white/5"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !changed}
            className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* dni pod sebou, rovnaký look ako PlanTable + PlanSingle */}
      <div className="space-y-4">
        {days.map((dIso) => {
          const list = draftByDay[dIso] ?? [];
          const isSelected = selectedDay === dIso;

          // keď v daný deň nemáme tréningy, ukáž len "žiadny tréning"
          return (
            <div
              key={dIso}
              className={[
                "rounded-2xl border border-white/10 p-3 md:p-4 space-y-3",
                isSelected ? "ring-1 ring-emerald-500/70" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => handleDayClick(dIso)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-xs font-semibold tracking-tight">
                    {prettySkDate(dIso)}
                  </div>
                  <div className="text-[11px] opacity-70">
                    {list.length
                      ? `${list.length} tréning(ov)`
                      : "Žiadny tréning"}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                    vybraný
                  </span>
                )}
              </button>

              {list.length > 0 && (
                <ul className="space-y-3">
                  {list.map((row: any, idx: number) => {
                    const sess: AnyObj = row.payload ?? row;
                    const sport = row.sport || detectSport(sess) || "other";

                    const title = normTitle(row, sess);
                    const dur = normDuration(row, sess);
                    const intensity = normIntensity(row, sess);
                    const target = normTarget(sess);
                    const notes = normNotes(sess);

                    const status: PlanStatus = "planned";

                    return (
                      <li key={`${row.id}-${idx}`}>
                        <PlanSingle
                          id={Number(row.id)}
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