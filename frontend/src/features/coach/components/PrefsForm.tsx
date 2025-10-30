"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import useInfoMessage from "@/shared/hooks/useInfoMessage";
import { getPrefs, savePrefs } from "@/features/coach/api/prefs";
import {
  DEFAULT_PREFS,
  type CoachPrefs,
  type GoalKind,
  type SportKind,
} from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/features/coach/types/day";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";

const DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SPORTS: SportKind[] = ["run", "ride", "strength"];


/** --- helpers --- */
function mergeWithDefaults(p: CoachPrefs): CoachPrefs {
  return {
    ...DEFAULT_PREFS,
    ...p,
    targets: {
      ...DEFAULT_PREFS.targets!,
      ...(p.targets ?? {}),
      run: { ...DEFAULT_PREFS.targets!.run, ...(p.targets?.run ?? {}) },
      ride: { ...DEFAULT_PREFS.targets!.ride, ...(p.targets?.ride ?? {}) },
      strength: {
        ...DEFAULT_PREFS.targets!.strength,
        ...(p.targets?.strength ?? {}),
      },
    },
    preferences: { ...DEFAULT_PREFS.preferences!, ...(p.preferences ?? {}) },
    primary_sports:
      p.primary_sports ?? p.sports ?? DEFAULT_PREFS.primary_sports,
  };
}

function normalizeForBE(p: CoachPrefs): CoachPrefs {
  const out: CoachPrefs = { ...p };
  // konsolidácia polí, žiadne undefined vs. null „šumy“
  if (!out.primary_sports && out.sports) out.primary_sports = out.sports;
  delete (out as any).sports;
  return out;
}


function Chip({
  active,
  children,
  onClick,
  disabled = false,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "px-2 py-1 rounded text-sm border",
        active
          ? "bg-emerald-600 border-emerald-500 text-white"
          : "bg-gray-900 border-gray-700 text-gray-100",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-emerald-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export default function PrefsForm() {
  const { userId } = useUserId();
  const { success, error } = useInfoMessage();
  const { refresh } = useCoachData();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<CoachPrefs>(DEFAULT_PREFS);
  
  // ---- LOAD
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const got = await getPrefs(userId);
        if (got) setPrefs(mergeWithDefaults(got));
      } catch (e: any) {
        error(`Prefs load failed: ${e?.message ?? e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ---- handlers
  const setWeeks = (v: number | "") =>
    setPrefs((p) => ({ ...p, weeks: v === "" ? undefined : Number(v) }));

  const toggleSport = (s: SportKind) =>
    setPrefs((p) => {
      const arr = p.primary_sports ?? p.sports ?? [];
      const has = arr.includes(s);
      const next = has ? arr.filter((x) => x !== s) : [...arr, s];
      return { ...p, primary_sports: next };
    });

  const toggleDay = (key: "days_off" | "long_run_days", d: DayAbbrev) =>
    setPrefs((p) => {
      const base = p.preferences ?? DEFAULT_PREFS.preferences!;
      const arr = (base[key] ?? []) as DayAbbrev[];
      const has = arr.includes(d);
      const next = has ? arr.filter((x) => x !== d) : [...arr, d];
      return { ...p, preferences: { ...base, [key]: next } };
    });

  const setGoalKind = (g: GoalKind) =>
    setPrefs((p) => ({ ...p, goal_kind: g }));

  const setDistance = (dist: string) =>
    setPrefs((p) => ({ ...p, distance: dist || undefined }));

  const setRunTarget = (
    k:
      | "race_goal"
      | "current_best_time"
      | "target_time"
      | "longest_recent_distance_km",
    v: string
  ) =>
    setPrefs((p) => {
      const run = p.targets?.run ?? DEFAULT_PREFS.targets!.run;
      let patch: any = v;
      if (k === "longest_recent_distance_km") {
        patch = v ? Number(v) : null;
      }
      return {
        ...p,
        targets: {
          ...(p.targets ?? DEFAULT_PREFS.targets!),
          run: { ...run, [k]: patch || null },
        },
      };
    });

  const setPrefFlag = (
    k: "avoid_back_to_back_hard" | "use_zones" | "wu_cd_detail",
    v: boolean
  ) =>
    setPrefs((p) => ({
      ...p,
      preferences: { ...(p.preferences ?? DEFAULT_PREFS.preferences!), [k]: v },
    }));

  // ---- SAVE
  const canSave = useMemo(() => !saving && !!userId, [saving, userId]);

  const onSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      await savePrefs(userId, normalizeForBE(prefs));
      await refresh?.();
      success("Preferences saved");
    } catch (e: any) {
      error(`Save failed: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-4">
      <h2 className="text-lg font-semibold">Preferences</h2>

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <>
          {/* High-level goal */}
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <div className="text-sm opacity-80">Goal kind</div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {(
                [
                  "race_time",
                  "improve_speed",
                  "improve_endurance",
                  "improve_overall",
                  "maintain",
                ] as GoalKind[]
              ).map((g) => (
                <Chip
                  key={g}
                  active={prefs.goal_kind === g}
                  onClick={() => setGoalKind(g)}
                >
                  {g}
                </Chip>
              ))}
            </div>
          </div>

          {/* Race distance + run targets */}
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <div className="text-sm opacity-80">Distance</div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <select
                value={prefs.distance ?? ""}
                onChange={(e) => setDistance(e.target.value)}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
              >
                <option value="">— none —</option>
                <option value="5k">5k</option>
                <option value="10k">10k</option>
                <option value="half">half</option>
                <option value="marathon">marathon</option>
              </select>

              <input
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                placeholder="current best (hh:mm:ss)"
                value={prefs.targets?.run.current_best_time ?? ""}
                onChange={(e) =>
                  setRunTarget("current_best_time", e.target.value)
                }
              />
              <input
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
                placeholder="target time (hh:mm:ss)"
                value={prefs.targets?.run.target_time ?? ""}
                onChange={(e) => setRunTarget("target_time", e.target.value)}
              />
            </div>
          </div>

          {/* Program horizon + sports */}
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <div className="text-sm opacity-80">Weeks</div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={52}
                value={prefs.weeks ?? ""}
                onChange={(e) =>
                  setWeeks(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
              />

              <div className="flex items-center gap-2">
                {SPORTS.map((s) => (
                  <Chip
                    key={s}
                    active={(
                      prefs.primary_sports ??
                      prefs.sports ??
                      []
                    ).includes(s)}
                    onClick={() => toggleSport(s)}
                  >
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Days off */}
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <div className="text-sm opacity-80">Days off</div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <Chip
                  key={`off-${d}`}
                  active={(prefs.preferences?.days_off ?? []).includes(d)}
                  onClick={() => toggleDay("days_off", d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </div>

          {/* Long run days */}
          <div className="grid sm:grid-cols-3 gap-3 items-center">
            <div className="text-sm opacity-80">Long-run days</div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <Chip
                  key={`long-${d}`}
                  active={(prefs.preferences?.long_run_days ?? []).includes(d)}
                  onClick={() => toggleDay("long_run_days", d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="grid sm:grid-cols-3 gap-3 items-start">
            <div className="text-sm opacity-80">Rules</div>
            <div className="sm:col-span-2 flex flex-col gap-2">
              <Toggle
                checked={!!prefs.preferences?.avoid_back_to_back_hard}
                onChange={(v) => setPrefFlag("avoid_back_to_back_hard", v)}
                label="Avoid two hard days in a row"
              />
              <Toggle
                checked={!!prefs.preferences?.use_zones}
                onChange={(v) => setPrefFlag("use_zones", v)}
                label="Use HR/pace zones"
              />
              <Toggle
                checked={!!prefs.preferences?.wu_cd_detail}
                onChange={(v) => setPrefFlag("wu_cd_detail", v)}
                label="Include WU/CD details"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onSave}
              disabled={!canSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50 text-sm"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}