"use client";

import { useMemo, useState } from "react";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";
import type {
  CoachPrefs,
  GoalKind,
  SportKind,
} from "@/features/coach/types/prefsTypes";
import useInfoMessage from "@/shared/hooks/useInfoMessage";
import type {
  DayAbbrev,
} from "@/features/coach/types/day";
const ALL_DAYS: DayAbbrev[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const ALL_SPORTS: SportKind[] = ["run","ride","strength"];
const ALL_GOALS: GoalKind[] = [
  "race_time", "improve_speed", "improve_endurance", "improve_overall", "maintain",
];

export default function PrefsForm() {
  const { prefs, savePrefs, refresh } = useCoachData();
  const { success, error } = useInfoMessage();

  // lokálna editačná kópia
  const [local, setLocal] = useState<CoachPrefs>(prefs);

  // keep in sync, keď sa zmenia prefs zvonka (napr. po refresh z iného zariadenia)
  useMemo(() => setLocal(prefs), [prefs]); // intentionally using useMemo as a tiny "effect"

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] => {
    const base = arr ?? [];
    return base.includes(v) ? base.filter(x => x !== v) : [...base, v];
  };

  const setPref = <K extends keyof CoachPrefs>(key: K, val: CoachPrefs[K]) =>
    setLocal(prev => ({ ...prev, [key]: val }));

  const setPrefNested = (path: "preferences.days_off" | "preferences.long_run_days" | "primary_sports", v: any) => {
    if (path === "primary_sports") {
      setLocal(prev => ({ ...prev, primary_sports: v }));
      return;
    }
    const p = prevPrefs(local);
    const next = { ...local, preferences: p };
    if (path.endsWith("days_off")) next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days")) next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const prevPrefs = (p: CoachPrefs) =>
    p.preferences ?? { days_off: [], long_run_days: [], avoid_back_to_back_hard: true, use_zones: true, wu_cd_detail: true };

  const onSave = async () => {
    try {
      await savePrefs(local);
      success("Preferences saved");
      await refresh();
    } catch (e: any) {
      error(String(e?.message ?? e));
    }
  };

  const onRefresh = async () => {
    try {
      await refresh();
      success("Refreshed");
    } catch (e: any) {
      error(String(e?.message ?? e));
    }
  };

  const pref = prevPrefs(local);

  return (
    <div className="space-y-4">
      {/* Goal */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex flex-wrap gap-2">
          {ALL_GOALS.map(g => (
            <button
              key={g}
              onClick={() => setPref("goal_kind", g)}
              className={[
                "px-3 py-1.5 rounded text-sm border",
                local.goal_kind === g
                  ? "bg-emerald-600 border-emerald-600"
                  : "bg-gray-900 border-gray-700 hover:bg-gray-800",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="weeks (e.g. 8, 10, 12)"
            inputMode="numeric"
            value={local.weeks ?? ""}
            onChange={(e) => setPref("weeks", e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="current best (hh:mm:ss)"
            value={local.targets?.run.current_best_time ?? ""}
            onChange={(e) =>
              setLocal(prev => ({
                ...prev,
                targets: {
                  ...prev.targets!,
                  run: { ...(prev.targets?.run ?? { race_goal: null, current_best_time: null, target_time: null, longest_recent_distance_km: null }),
                    current_best_time: e.target.value || null
                  },
                  ride: prev.targets?.ride ?? { focus: "endurance", weekly_time_target_min: null },
                  strength: prev.targets?.strength ?? { focus: "general", sessions_per_week: 2 },
                }
              }))
            }
          />
          <input
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm"
            placeholder="target time (hh:mm:ss)"
            value={local.targets?.run.target_time ?? ""}
            onChange={(e) =>
              setLocal(prev => ({
                ...prev,
                targets: {
                  ...prev.targets!,
                  run: { ...(prev.targets?.run ?? { race_goal: null, current_best_time: null, target_time: null, longest_recent_distance_km: null }),
                    target_time: e.target.value || null
                  },
                  ride: prev.targets?.ride ?? { focus: "endurance", weekly_time_target_min: null },
                  strength: prev.targets?.strength ?? { focus: "general", sessions_per_week: 2 },
                }
              }))
            }
          />
        </div>
      </div>

      {/* Sports */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Sports</div>
        <div className="flex flex-wrap gap-2">
          {ALL_SPORTS.map(s => {
            const cur = local.primary_sports ?? local.sports ?? [];
            const next = toggleInArray(cur, s);
            const active = cur.includes(s);
            return (
              <button
                key={s}
                onClick={() => setPrefNested("primary_sports", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600"
                         : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Days off */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Days off</div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const next = toggleInArray(pref.days_off, d);
            const active = pref.days_off?.includes(d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.days_off", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600"
                         : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Long run days */}
      <div className="space-y-2">
        <div className="text-sm font-medium opacity-90">Preferred long-run days</div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const next = toggleInArray(pref.long_run_days ?? [], d);
            const active = pref.long_run_days?.includes(d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.long_run_days", next)}
                className={[
                  "px-3 py-1.5 rounded text-sm border",
                  active ? "bg-emerald-600 border-emerald-600"
                         : "bg-gray-900 border-gray-700 hover:bg-gray-800",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Switches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.avoid_back_to_back_hard}
            onChange={(e) =>
              setLocal(prev => ({
                ...prev,
                preferences: { ...prevPrefs(prev), avoid_back_to_back_hard: e.target.checked },
              }))
            }
          />
          Avoid two hard days in a row
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.use_zones}
            onChange={(e) =>
              setLocal(prev => ({
                ...prev,
                preferences: { ...prevPrefs(prev), use_zones: e.target.checked },
              }))
            }
          />
          Use zones
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.wu_cd_detail}
            onChange={(e) =>
              setLocal(prev => ({
                ...prev,
                preferences: { ...prevPrefs(prev), wu_cd_detail: e.target.checked },
              }))
            }
          />
          Include WU/CD details
        </label>
      </div>

      {/* actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm"
        >
          Save
        </button>
        <button
          onClick={onRefresh}
          className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}