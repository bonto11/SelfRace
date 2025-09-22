"use client";

import { CoachPrefs, GoalKind } from "./prefsTypes";

export default function GoalPicker({
  value,
  onChange,
}: {
  value?: CoachPrefs;
  onChange: (prefs: CoachPrefs) => void;
}) {
  const v = value ?? {};

  const set = (patch: Partial<CoachPrefs>) => onChange({ ...v, ...patch });

  return (
    <div className="bg-gray-800 rounded p-3 space-y-2">
      <h3 className="font-semibold">Goal</h3>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm opacity-80">Goal kind</label>
        <select
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1"
          value={v.goal_kind ?? ""}
          onChange={(e) => set({ goal_kind: (e.target.value || undefined) as GoalKind })}
        >
          <option value="">— choose —</option>
          <option value="race_time">Zlepšiť čas na pretekoch</option>
          <option value="improve_speed">Zlepšiť rýchlosť</option>
          <option value="improve_endurance">Zlepšiť vytrvalosť</option>
          <option value="improve_overall">Zlepšiť celkovo</option>
          <option value="maintain">Udržať kondíciu</option>
        </select>

        {(v.goal_kind === "race_time" || v.goal_kind === "improve_speed") && (
          <>
            <label className="text-sm opacity-80 ml-3">Distance</label>
            <input
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-24"
              placeholder="5k"
              value={v.distance ?? ""}
              onChange={(e) => set({ distance: e.target.value || undefined })}
            />

            <label className="text-sm opacity-80 ml-3">Current</label>
            <input
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-24"
              placeholder="5:10"
              value={v.current_pace ?? ""}
              onChange={(e) => set({ current_pace: e.target.value || undefined })}
            />

            <label className="text-sm opacity-80 ml-3">Target</label>
            <input
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-24"
              placeholder="4:30"
              value={v.target_pace ?? ""}
              onChange={(e) => set({ target_pace: e.target.value || undefined })}
            />
          </>
        )}
      </div>
    </div>
  );
}