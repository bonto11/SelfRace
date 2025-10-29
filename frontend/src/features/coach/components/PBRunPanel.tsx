"use client";

import { useCoachData } from "@/features/coach/data/CoachDataProvider";

function mToKm(m: number) { return Math.round((m / 1000) * 10) / 10; }

export default function PBRunPanel() {
  const { pbRun } = useCoachData();
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-3">
      <h2 className="text-lg font-semibold">Personal Bests — Running (detail)</h2>
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th className="px-2 py-1">Distance</th>
            <th className="px-2 py-1">Best time</th>
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Event</th>
          </tr>
        </thead>
        <tbody>
          {pbRun.map((b, i) => (
            <tr key={i} className="border-t border-gray-300 dark:border-gray-700">
              <td className="px-2 py-1">{mToKm(b.distance_m)} km</td>
              <td className="px-2 py-1 tabular-nums">{b.time_str ?? "—"}</td>
              <td className="px-2 py-1">{b.date ?? "—"}</td>
              <td className="px-2 py-1">{b.event_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TODO: editačný formulár PB (voliteľné), alebo CTA „Import from Strava“ */}
      <div className="text-xs opacity-80"><em>Later: edit/add PBs or import.</em></div>
    </div>
  );
}