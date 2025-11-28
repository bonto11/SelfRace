// src/features/coach/components/PlanActive.tsx
"use client";

import * as React from "react";
import {
  CARD,
  NO_X_OVERFLOW,
  SURFACE_INLINE,
  SURFACE_CARD,
} from "@/shared/ui/classes";
import { usePlanData } from "@/shared/components/dataProviders/PlanDataProvider";
import { todayISO, addDays } from "@/features/activity/utils/activity";
import SportBadge from "@/shared/components/ui/SportBadge";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import Button from "@/shared/components/ui/Button";
import {
  apiSavePlanReorder,
  type PlanReorderUpdate,
} from "@/features/coach/api/plan";

type AnyObj = Record<string, any>;
const MAX_PER_DAY = 2;

/* ---------------- helpers (rovnaké ako pri pláne) ---------------- */

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

function normTitle(row: AnyObj, sess: AnyObj) {
  const sessionTypeId =
    typeof sess?.session_type === "string"
      ? sess.session_type
      : typeof row.session_type === "string"
      ? row.session_type
      : null;

  const trainingDef = sessionTypeId ? findTrainingTypeById(sessionTypeId) : null;
  return (
    trainingDef?.label ?? sess?.title ?? sess?.name ?? row?.title ?? "Tréning"
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

/* ---------------- lokálne typy ---------------- */

type DraftSession = {
  id: number;
  plan_date: string;
  session_index: number;
  raw: AnyObj;
};

type DraftByDay = Record<string, DraftSession[]>;

/* ---------------- hlavný komponent ---------------- */

export default function PlanActive() {
  const { planRows, refresh } = usePlanData();
  const rows = planRows ?? [];

  const [draft, setDraft] = React.useState<DraftByDay>({});
  const [originalPos, setOriginalPos] = React.useState<
    Record<number, { plan_date: string; session_index: number }>
  >({});
  const [saving, setSaving] = React.useState(false);
  const [fatalError, setFatalError] = React.useState<string | null>(null);

  const today = todayISO();
  const from = addDays(today, -5);
  const to = addDays(today, 10);

  // log hneď pri rendri
  console.log("[PlanActive] render", {
    planRowsLength: rows.length,
    from,
    to,
  });

  // zoznam dní v rozsahu
  const days: string[] = React.useMemo(() => {
    const out: string[] = [];
    let cur = from;
    while (cur <= to) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    console.log("[PlanActive] computed days", out);
    return out;
  }, [from, to]);

  // init draftu z planRows
  React.useEffect(() => {
    console.log("[PlanActive] useEffect init draft – start", {
      rowsLength: rows.length,
    });

    try {
      const pos: Record<number, { plan_date: string; session_index: number }> =
        {};
      const tmp: DraftByDay = {};

      for (const r of rows) {
        if (!r) continue;
        const dIso = String((r as any).plan_date || "").slice(0, 10);
        if (!dIso) continue;

        if (dIso < from || dIso > to) continue;

        const sess: AnyObj = (r as any).payload ?? r;
        if (isRestSession(r, sess)) continue;

        if (!tmp[dIso]) tmp[dIso] = [];

        const idx = Number.isFinite((r as any).session_index)
          ? Number((r as any).session_index)
          : tmp[dIso].length;

        const idNum = Number((r as any).id);
        if (!Number.isFinite(idNum)) continue;

        const item: DraftSession = {
          id: idNum,
          plan_date: dIso,
          session_index: idx,
          raw: r,
        };
        tmp[dIso].push(item);
        pos[item.id] = { plan_date: dIso, session_index: idx };
      }

      // sort + reindex
      Object.keys(tmp).forEach((d) => {
        tmp[d].sort((a, b) => a.session_index - b.session_index);
        tmp[d] = tmp[d].map((it, idx) => ({ ...it, session_index: idx }));
      });

      console.log("[PlanActive] useEffect init draft – built", {
        days: Object.keys(tmp),
        totalSessions: Object.values(tmp).reduce(
          (acc, arr) => acc + arr.length,
          0
        ),
      });

      setDraft(tmp);
      setOriginalPos(pos);
      setFatalError(null);
    } catch (e: any) {
      console.error("[PlanActive] ERROR while building draft", e);
      setFatalError(String(e?.message || e));
      setDraft({});
      setOriginalPos({});
    }
  }, [rows, from, to]);

  // move handler – šípky hore/dole
  const moveSession = (sessionId: number, dir: "up" | "down") => {
    console.log("[PlanActive] moveSession", { sessionId, dir });

    setDraft((prev) => {
      const next: DraftByDay = { ...prev };
      const dayKeys = days;

      let foundDayIdx = -1;
      let foundIdx = -1;

      for (let di = 0; di < dayKeys.length; di += 1) {
        const arr = next[dayKeys[di]] ?? [];
        const idx = arr.findIndex((s) => s.id === sessionId);
        if (idx !== -1) {
          foundDayIdx = di;
          foundIdx = idx;
          break;
        }
      }

      if (foundDayIdx === -1) {
        console.warn("[PlanActive] moveSession – session not found", {
          sessionId,
        });
        return prev;
      }

      const curDay = dayKeys[foundDayIdx];
      const curArr = [...(next[curDay] ?? [])];

      if (dir === "up") {
        if (foundIdx > 0) {
          // v rámci dňa
          const [moved] = curArr.splice(foundIdx, 1);
          curArr.splice(foundIdx - 1, 0, moved);
          next[curDay] = curArr.map((s, i) => ({ ...s, session_index: i }));
          return next;
        }
        // posun na predchádzajúci deň
        if (foundDayIdx === 0) return prev;
        const targetDay = dayKeys[foundDayIdx - 1];
        const targetArr = [...(next[targetDay] ?? [])];
        if (targetArr.length >= MAX_PER_DAY) {
          console.log("[PlanActive] moveSession up – target full", {
            targetDay,
          });
          return prev;
        }

        const [moved] = curArr.splice(foundIdx, 1);
        const movedUpdated: DraftSession = {
          ...moved,
          plan_date: targetDay,
        };
        targetArr.push(movedUpdated);

        next[curDay] = curArr.map((s, i) => ({ ...s, session_index: i }));
        next[targetDay] = targetArr.map((s, i) => ({ ...s, session_index: i }));
        return next;
      }

      // dir === "down"
      if (foundIdx < curArr.length - 1) {
        const [moved] = curArr.splice(foundIdx, 1);
        curArr.splice(foundIdx + 1, 0, moved);
        next[curDay] = curArr.map((s, i) => ({ ...s, session_index: i }));
        return next;
      }

      if (foundDayIdx === dayKeys.length - 1) return prev;
      const targetDay = dayKeys[foundDayIdx + 1];
      const targetArr = [...(next[targetDay] ?? [])];
      if (targetArr.length >= MAX_PER_DAY) {
        console.log("[PlanActive] moveSession down – target full", {
          targetDay,
        });
        return prev;
      }

      const [moved] = curArr.splice(foundIdx, 1);
      const movedUpdated: DraftSession = {
        ...moved,
        plan_date: targetDay,
      };
      targetArr.unshift(movedUpdated);

      next[curDay] = curArr.map((s, i) => ({ ...s, session_index: i }));
      next[targetDay] = targetArr.map((s, i) => ({ ...s, session_index: i }));
      return next;
    });
  };

  const handleReset = () => {
    console.log("[PlanActive] handleReset");
    setDraft({});
    setOriginalPos({});
    void refresh(true);
  };

  const handleSave = async () => {
    console.log("[PlanActive] handleSave – start");
    setSaving(true);
    try {
      const updates: PlanReorderUpdate[] = [];

      Object.entries(draft).forEach(([dayIso, list]) => {
        list.forEach((it, idx) => {
          const orig = originalPos[it.id];
          const newDate = dayIso;
          const newIndex = idx;

          if (!orig || orig.plan_date !== newDate || orig.session_index !== newIndex) {
            updates.push({
              id: it.id,
              plan_date: newDate,
              session_index: newIndex,
            });
          }
        });
      });

      console.log("[PlanActive] handleSave – computed updates", updates);

      if (!updates.length) {
        console.log("[PlanActive] handleSave – no changes");
        setSaving(false);
        return;
      }

      const userId =
        rows[0]?.user_id != null ? Number(rows[0].user_id) : null;
      if (!userId) {
        console.warn("[PlanActive] handleSave – missing userId");
        setSaving(false);
        return;
      }

      const res = await apiSavePlanReorder(userId, updates);
      console.log("[PlanActive] savePlanReorder result", res);

      if (res.success) {
        await refresh(true);
      }
    } catch (e) {
      console.error("[PlanActive] handleSave ERROR", e);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!Object.keys(draft).length) return false;

    for (const [dayIso, list] of Object.entries(draft)) {
      list.forEach((it, idx) => {
        const orig = originalPos[it.id];
        if (!orig) {
          // nový / neznámy → ber ako zmenu
          console.log("[PlanActive] hasChanges – new row", { id: it.id });
          // ale nehadžeme error, len vrátime true
        }
        if (!orig || orig.plan_date !== dayIso || orig.session_index !== idx) {
          return true;
        }
      });
    }
    return false;
  }, [draft, originalPos]);

  const changed = !!hasChanges;

  /* ---------------- rendering guards ---------------- */

  if (!rows.length) {
    console.log("[PlanActive] no rows – render nothing");
    return null;
  }

  if (fatalError) {
    console.warn("[PlanActive] fatalError state – showing fallback UI", {
      fatalError,
    });
    return (
      <section className={[CARD, "p-3 md:p-4", NO_X_OVERFLOW].join(" ")}>
        <h2 className="text-lg font-bold mb-1">Aktívny plán — editácia</h2>
        <p className="text-sm text-red-300">
          Editácia plánu je dočasne vypnutá kvôli chybe: {fatalError}
        </p>
      </section>
    );
  }

  /* ---------------- hlavný render ---------------- */

  return (
    <section className={[CARD, "p-3 md:p-4 space-y-3", NO_X_OVERFLOW].join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Aktívny plán — editácia</h2>
        <span className="text-xs opacity-70">
          Šípkami hore/dole presúvaš tréningy medzi dňami (max {MAX_PER_DAY} tréningy
          za deň).
        </span>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || !changed}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={saving || !changed}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {days.map((dIso) => {
          const list = draft[dIso] ?? [];
          const isToday = dIso === today;

          return (
            <div
              key={dIso}
              className={[
                SURFACE_CARD,
                "px-3 py-2 space-y-2 border border-white/10",
                isToday ? "ring-1 ring-emerald-500/60" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold tracking-tight">
                  {prettySkDate(dIso)}
                </div>
                {isToday && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                    Today
                  </span>
                )}
              </div>

              {list.length === 0 && (
                <div className="text-xs opacity-60">Žiadny tréning</div>
              )}

              {list.length > 0 && (
                <ul className="space-y-2">
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
                          className={[
                            SURFACE_INLINE,
                            "px-3 py-2 flex items-start gap-2",
                          ].join(" ")}
                        >
                          <div className="flex flex-col flex-1 gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold truncate">
                                {title}
                              </div>
                              <SportBadge sport={sport} />
                            </div>

                            <div className="text-[11px] opacity-80 flex flex-wrap gap-1">
                              {dur && <span>{dur}</span>}
                              {intensity && <span>· {intensity}</span>}
                              {target && <span>· {target}</span>}
                            </div>

                            {notes && (
                              <div className="mt-0.5 text-xs opacity-75 line-clamp-3">
                                {notes}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 ml-1">
                            <button
                              type="button"
                              className="w-7 h-7 rounded-full border border-white/20 text-xs flex items-center justify-center hover:bg-white/10"
                              onClick={() => moveSession(it.id, "up")}
                              aria-label="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="w-7 h-7 rounded-full border border-white/20 text-xs flex items-center justify-center hover:bg-white/10"
                              onClick={() => moveSession(it.id, "down")}
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                          </div>
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