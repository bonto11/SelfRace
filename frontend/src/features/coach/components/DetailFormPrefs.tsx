"use client";

import { useState } from "react";
import type { CoachPrefs } from "@/features/coach/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SPORTS = ["run", "ride", "strength", "mixed", "skate"] as const;

export default function PrefsDetailForm() {
  const [prefs, setPrefs] = useState<CoachPrefs>({
    weeks: 8,
    sports: ["run", "ride", "strength"],
    daysOff: ["Mon", "Fri"],
    longRunDays: ["Sat"],
    avoidTwoHardInRow: true,
    useZones: true,
    includeStrides: false,
  });

  const toggle = <T extends string>(key: keyof CoachPrefs, value: T) => {
    setPrefs((p) => {
      const arr = new Set(p[key] as unknown as string[]);
      arr.has(value) ? arr.delete(value) : arr.add(value);
      return { ...p, [key]: Array.from(arr) };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm opacity-70 mb-1">
          Block length (weeks)
        </label>
        <input
          type="number"
          min={2}
          max={24}
          value={prefs.weeks}
          onChange={(e) =>
            setPrefs((p) => ({ ...p, weeks: Number(e.target.value) }))
          }
          className="px-2 py-1 rounded bg-gray-800 border border-gray-700 w-24"
        />
      </div>

      <div>
        <div className="text-sm opacity-70 mb-1">Sports</div>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s}
              onClick={() => toggle("sports", s)}
              className={`px-2 py-1 rounded border ${
                prefs.sports.includes(s)
                  ? "bg-blue-600 border-blue-500"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <div className="text-sm opacity-70 mb-1">Days off</div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => toggle("daysOff", d)}
                className={`px-2 py-1 rounded border ${
                  prefs.daysOff.includes(d)
                    ? "bg-rose-600 border-rose-500"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm opacity-70 mb-1">Preferred long-run days</div>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => toggle("longRunDays", d)}
                className={`px-2 py-1 rounded border ${
                  prefs.longRunDays.includes(d)
                    ? "bg-emerald-600 border-emerald-500"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.avoidTwoHardInRow}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, avoidTwoHardInRow: e.target.checked }))
            }
          />
          Avoid two hard days in a row
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.useZones}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, useZones: e.target.checked }))
            }
          />
          Use zones
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={prefs.includeStrides}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, includeStrides: e.target.checked }))
            }
          />
          Include strides
        </label>
      </div>

      <div className="flex gap-2">
        <button className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">
          Save
        </button>
        <button className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">
          Reset
        </button>
      </div>
    </div>
  );
}
