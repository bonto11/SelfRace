"use client";

import { CoachPrefs, SportKind, DayAbbrev, Preferences } from "./prefsTypes";

const LS_KEY = "coach:prefs";

// Default pre vnorené preferences – aby nikdy neboli undefined
const PREFS_EMPTY: Preferences = {
  days_off: [],
  long_run_days: [],
  avoid_back_to_back_hard: false,
  use_zones: false,
  wu_cd_detail: false,
};

export default function PrefsForm({
  value,
  onChange,
}: {
  value?: CoachPrefs;
  onChange: (patch: Partial<CoachPrefs>) => void;
}) {
  const v = value ?? {};

  // helpery
  const withPrefs = (p?: Preferences): Preferences => ({ ...PREFS_EMPTY, ...(p ?? {}) });

  const toggleSport = (s: SportKind) => {
    const set = new Set(v.primary_sports ?? v.sports ?? []);
    set.has(s) ? set.delete(s) : set.add(s);
    onChange({ primary_sports: Array.from(set) as SportKind[] });
  };

  const toggleDay = (arr: DayAbbrev[] | undefined, d: DayAbbrev) => {
    const set = new Set(arr ?? []);
    set.has(d) ? set.delete(d) : set.add(d);
    return Array.from(set) as DayAbbrev[];
  };

  const save = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(v));
    } catch {}
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<CoachPrefs>;
      onChange(parsed);
    } catch {}
  };

  return (
    <div className="bg-gray-800 rounded p-3 space-y-3">
      <h3 className="font-semibold">Preferences</h3>

      {/* Weeks */}
      <div className="flex items-center gap-2">
        <label className="text-sm opacity-80">Weeks</label>
        <input
          type="number"
          min={4}
          max={24}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-20"
          value={v.weeks ?? ""}
          onChange={(e) =>
            onChange({ weeks: e.target.value ? Number(e.target.value) : undefined })
          }
        />
      </div>

      {/* Sports */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm opacity-80">Sports</span>
        {(["run", "bike", "strength"] as SportKind[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleSport(s)}
            className={`px-2 py-1 rounded border text-sm ${
              (v.primary_sports ?? v.sports ?? []).includes(s)
                ? "bg-emerald-700/60 border-emerald-600"
                : "bg-gray-900 border-gray-700"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Days off */}
      <div className="space-y-1">
        <div className="text-sm opacity-80">Days off</div>
        {(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as DayAbbrev[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() =>
              onChange({
                preferences: {
                  ...withPrefs(v.preferences),
                  days_off: toggleDay(v.preferences?.days_off, d),
                },
              })
            }
            className={`mr-1 mb-1 px-2 py-1 rounded border text-xs ${
              (v.preferences?.days_off ?? []).includes(d)
                ? "bg-sky-700/50 border-sky-600"
                : "bg-gray-900 border-gray-700"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Switches */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.preferences?.avoid_back_to_back_hard}
            onChange={(e) =>
              onChange({
                preferences: {
                  ...withPrefs(v.preferences),
                  avoid_back_to_back_hard: e.target.checked,
                },
              })
            }
          />
          Avoid two hard days in a row
        </label>

        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.preferences?.use_zones}
            onChange={(e) =>
              onChange({
                preferences: {
                  ...withPrefs(v.preferences),
                  use_zones: e.target.checked,
                },
              })
            }
          />
          Use zones
        </label>

        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!v.preferences?.wu_cd_detail}
            onChange={(e) =>
              onChange({
                preferences: {
                  ...withPrefs(v.preferences),
                  wu_cd_detail: e.target.checked,
                },
              })
            }
          />
          Include WU/CD detail
        </label>
      </div>

      {/* Save / Load */}
      <div className="flex gap-2">
        <button
          onClick={save}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
        >
          Save prefs
        </button>
        <button
          onClick={load}
          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm"
        >
          Load prefs
        </button>
      </div>
    </div>
  );
}