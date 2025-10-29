"use client";

import type { PBRun } from "@/features/coach/types";

const MOCK: PBRun[] = [
  { distanceKm: 1, best: "00:03:52", date: "2024-09-15" },
  { distanceKm: 5, best: "00:23:13", date: "2024-10-02" },
  { distanceKm: 10, best: "00:50:17" },
  { distanceKm: 21.1, best: "02:22:07" },
];

function fmtDist(k: number) {
  return k === 21.1 ? "Half marathon" : k === 42.2 ? "Marathon" : `${k} km`;
}

export default function PBRunTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th className="text-left px-2 py-1">Distance</th>
            <th className="text-left px-2 py-1">Best time</th>
            <th className="text-left px-2 py-1">Date</th>
            <th className="text-left px-2 py-1">Activity ID</th>
          </tr>
        </thead>
        <tbody>
          {MOCK.map((r) => (
            <tr
              key={r.distanceKm}
              className="border-t border-gray-300 dark:border-gray-700"
            >
              <td className="px-2 py-1">{fmtDist(r.distanceKm)}</td>
              <td className="px-2 py-1 tabular-nums">{r.best}</td>
              <td className="px-2 py-1">{r.date ?? "—"}</td>
              <td className="px-2 py-1">{r.activityId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs opacity-70 mt-2">+ Add / edit coming soon</div>
    </div>
  );
}
