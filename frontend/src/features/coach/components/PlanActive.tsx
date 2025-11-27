"use client";

import * as React from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import {
  CARD,
  NO_X_OVERFLOW,
  SCROLL_X,
  SURFACE_INLINE,
} from "@/shared/ui/classes";
import Button from "@/shared/components/ui/Button";
import SportBadge from "@/shared/components/ui/SportBadge";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import { apiSavePlanReorder, type PlanReorderUpdate } from "@/features/coach/api/plan";

type AnyObj = Record<string, any>;

/* ---- helpers z PlanTable / kalendára (skrátené) ---- */

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

function normTarget(it: AnyObj): string | null {
  const hr   = it?.target_hr_bpm_range ?? it?.target_hr ?? null;
  const pace = it?.target_pace_min_per_km ?? null;
  const pow  = it?.target_power_watts ?? null;

  const mainT = Array.isArray(it?.structure?.main)
    ? it.structure.main[0]?.target
    : it?.structure?.main?.target;

  const hr2   = hr   ?? mainT?.hr ?? mainT?.heart_rate ?? null;
  const pace2 = pace ?? mainT?.pace ?? null;
  const pow2  = pow  ?? mainT?.power ?? null;

  const parts = [hrToText(hr2), paceToText(pace2), powerToText(pow2)].filter(Boolean);
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

/* ---- typy pre lokálny draft ---- */

type DraftSession = {
  id: number;
  plan_date: string;
  session_index: number;
  raw: AnyObj;
};

type DraftByDay = Record<string, DraftSession[]>;

type DragInfo = {
  sessionId: number;
  fromDate: string;
};

/* ---- hlavný komponent ---- */

export default function PlanActive() {
  const { userId } = useUserId();
  const { rows, refresh } = usePlanData();

  const [draft, setDraft] = React.useState<DraftByDay>({});
  const [originalPos, setOriginalPos] = React.useState<
    Record<number, { plan_date: string; session_index: number }>
  >({});
  const [dragOverDay, setDragOverDay] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const today = todayISO();
  const from = addDays(today, -5);
  const to = addDays(today, 10);

  // inicializácia draftu pri zmene rows
  React.useEffect(() => {
    const pos: Record<number, { plan_date: string; session_index: number }> = {};
    const tmp: DraftByDay = {};

    for (const r of rows) {
      const dIso = String(r.plan_date).slice(0, 10);
      if (dIso < from || dIso > to) continue;

      const sess: AnyObj = (r as any).payload ?? r;
      if (isRestSession(r, sess)) continue;

      if (!tmp[dIso]) tmp[dIso] = [];

      const idx = Number.isFinite(r.session_index)
        ? Number(r.session_index)
        : tmp[dIso].length;

      const item: DraftSession = {
        id: Number(r.id),
        plan_date: dIso,
        session_index: idx,
        raw: r,
      };
      tmp[dIso].push(item);

      pos[item.id] = { plan_date: dIso, session_index: idx };
    }

    // sortuj podľa session_index
    Object.keys(tmp).forEach((d) => {
      tmp[d].sort((a, b) => a.session_index - b.session_index);
      // reindex pre istotu
      tmp[d] = tmp[d].map((it, idx) => ({ ...it, session_index: idx }));
    });

    setDraft(tmp);
    setOriginalPos(pos);
  }, [rows, from, to]);

  // zoznam dní, ktoré zobrazujeme (aj dni bez plánov)
  const days: string[] = React.useMemo(() => {
    const out: string[] = [];
    let cur = from;
    while (cur <= to) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [from, to]);

  // DnD eventy

  const handleDragStart = (session: DraftSession, dayIso: string) => {
    const data: DragInfo = { sessionId: session.id, fromDate: dayIso };
    // ukladáme do window, lebo dataTransfer s JSON je otravný na mobile
    (window as any).__planDrag = data;
  };

  const handleDragEnter = (dayIso: string) => {
    setDragOverDay(dayIso);
  };

  const handleDragLeave = (dayIso: string) => {
    if (dragOverDay === dayIso) setDragOverDay(null);
  };

  const handleDropOnDay = (targetDay: string) => {
    const data: DragInfo | undefined = (window as any).__planDrag;
    (window as any).__planDrag = undefined;
    setDragOverDay(null);
    if (!data) return;

    const { sessionId, fromDate } = data;
    if (!sessionId || !fromDate) return;

    setDraft((prev) => {
      const next: DraftByDay = { ...prev };

      const fromArr = [...(next[fromDate] ?? [])];
      const targetArr = [...(next[targetDay] ?? [])];

      const idx = fromArr.findIndex((it) => it.id === sessionId);
      if (idx === -1) return prev;

      const [moved] = fromArr.splice(idx, 1);
      const newSession: DraftSession = {
        ...moved,
        plan_date: targetDay,
      };

      targetArr.push(newSession);

      // reindex oboch dní
      next[fromDate] = fromArr.map((it, i) => ({ ...it, session_index: i }));
      next[targetDay] = targetArr.map((it, i) => ({ ...it, session_index: i }));

      return next;
    });
  };

  const handleReset = () => {
    // trigger znovu init z rows
    setDraft({});
    setOriginalPos({});
    void refresh(true);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const updates: PlanReorderUpdate[] = [];

      Object.entries(draft).forEach(([dayIso, list]) => {
        list.forEach((it, idx) => {
          const orig = originalPos[it.id];
          const newDate = dayIso;
          const newIndex = idx;

          if (
            !orig ||
            orig.plan_date !== newDate ||
            orig.session_index !== newIndex
          ) {
            updates.push({
              id: it.id,
              plan_date: newDate,
              session_index: newIndex,
            });
          }
        });
      });

      const res = await apiSavePlanReorder(userId, updates);
      console.log("[PlanEditable] savePlanReorder result", res, updates);

      if (res.success) {
        await refresh(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = React.useMemo(() => {
    // jednoduché porovnanie: ak aspoň jeden riadok má inú pozíciu ako originalPos
    for (const [dayIso, list] of Object.entries(draft)) {
      for (const it of list) {
        const orig = originalPos[it.id];
        const idx = list.indexOf(it);
        if (!orig) return true;
        if (orig.plan_date !== dayIso || orig.session_index !== idx) {
          return true;
        }
      }
    }
    return false;
  }, [draft, originalPos]);

  return (
    <section className={[CARD, "p-3 md:p-4 space-y-3", NO_X_OVERFLOW].join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Aktívny plán — editácia</h2>
        <span className="text-xs opacity-70">
          Presúvaj tréningy medzi dňami (drag & drop). Uloženie je manuálne.
        </span>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || !hasChanges}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !hasChanges}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className={SCROLL_X}>
        <div className="flex gap-3 min-w-max py-1">
          {days.map((dIso) => {
            const list = draft[dIso] ?? [];
            const isToday = dIso === today;
            const isOver = dragOverDay === dIso;

            return (
              <div
                key={dIso}
                onDragEnter={() => handleDragEnter(dIso)}
                onDragLeave={() => handleDragLeave(dIso)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnDay(dIso)}
                className={[
                  "w-60 flex-shrink-0 rounded-2xl border border-white/10",
                  "bg-white/5 dark:bg-black/20",
                  "p-2 flex flex-col",
                  isToday ? "ring-1 ring-emerald-500/60" : "",
                  isOver ? "bg-white/10 dark:bg-white/10" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-semibold tracking-tight">
                    {prettySkDate(dIso)}
                  </div>
                  {isToday && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                      Today
                    </span>
                  )}
                </div>

                <div className="mt-1 text-[11px] opacity-70">
                  {list.length ? `${list.length} tréning(ov)` : "Žiadny tréning"}
                </div>

                <ul className="mt-2 space-y-2 flex-1">
                  {list.map((it) => {
                    const row = it.raw;
                    const sess: AnyObj = row.payload ?? row;
                    const sport = row.sport || detectSport(sess) || "other";
                    const title = normTitle(row, sess);
                    const dur = normDuration(row, sess);
                    const intensity = normIntensity(row, sess);
                    const target = normTarget(sess);
                    const notes = normNotes(sess);

                    return (
                      <li key={it.id}>
                        <div
                          draggable
                          onDragStart={() => handleDragStart(it, dIso)}
                          className={[
                            SURFACE_INLINE,
                            "px-3 py-2 cursor-move select-none",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold truncate">
                              {title}
                            </div>
                            <SportBadge sport={sport} />
                          </div>

                          <div className="mt-0.5 text-[11px] opacity-80 flex flex-wrap gap-1">
                            {dur && <span>{dur}</span>}
                            {intensity && <span>· {intensity}</span>}
                            {target && <span>· {target}</span>}
                          </div>

                          {notes && (
                            <div className="mt-1 text-xs opacity-75 line-clamp-3">
                              {notes}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}