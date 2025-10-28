// src/features/activity/components/ActivityTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SUBCARD, CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { ActivityRow } from "@/features/activity/utils/activity";
import ActivityDetail from "./ActivityDetail";
import { toEffSport, sportUiLabel } from "@/features/activity/utils/sport";
import { fmtSecondsHMS } from "@/shared/utils/format";

type Props = {
  start?: string;
  end?: string;
  /** jednorázový filter z grafu (ak máš konkrétny šport vybraný) */
  sport?: string; // "all" | "run" | "ride" | ...
  /** whitelist športov – ak je daný, zobraz iba tieto (napr. pre 80/20 chceme vylúčiť "walk") */
  allowedSports?: string[] | null;
};

export default function ActivityTable({
  start,
  end,
  sport = "all",
  allowedSports = null,
}: Props) {
  const { selectByRange, rows: allRows } = useActivityData();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const headerTitle = useMemo(
    () => (start && end ? `Týždeň ${start} → ${end}` : "História (vyber týždeň v grafe)"),
    [start, end]
  );

  useEffect(() => {
    setSelectedId(null);
    if (!start || !end) {
      setRows([]);
      return;
    }
    setLoading(true);

    // 1) všetky v rozsahu
    const inRange = selectByRange(start, end);

    // 2) šport z grafu (ak je zadaný)
    const bySport =
      sport && sport !== "all" ? inRange.filter((r) => toEffSport(r) === sport) : inRange;

    // 3) whitelist (napr. pre 80/20 vyhodiť walk)
    const finalRows =
      Array.isArray(allowedSports) && allowedSports.length
        ? bySport.filter((r) => allowedSports.includes(toEffSport(r)))
        : bySport;

    setRows(finalRows);
    setLoading(false);

    console.debug("[ACT][table] filter", {
      start,
      end,
      sport,
      allowedSports,
      allRows: allRows.length,
      inRange: inRange.length,
      afterSport: bySport.length,
      final: finalRows.length,
      sample: finalRows.slice(0, 3).map((r) => ({ id: r.activity_id, s: toEffSport(r) })),
    });
  }, [start, end, sport, allowedSports, selectByRange, allRows.length]);

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">{headerTitle}</h2>
        {sport && <div className="text-xs opacity-60">Filter: {sport}</div>}
      </div>

      {/* MOBILE */}
      <div className="sm:hidden space-y-2">
        {loading && <div className="opacity-70 py-4">Načítavam…</div>}
        {!loading &&
          rows.map((r) => {
            const eff = toEffSport(r);
            return (
              <button
                key={r.activity_id}
                onClick={() => setSelectedId(r.activity_id)}
                className="w-full text-left rounded border border-gray-700 p-3 bg-gray-900"
                title={r.name}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {new Date(r.date).toLocaleDateString("sk-SK")}
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded bg-gray-700">{sportUiLabel(eff)}</div>
                </div>
                <div className="truncate opacity-90">{r.name}</div>
                <div className="mt-1 text-xs opacity-75 flex gap-3">
                  <span>
                    {r.moving_time_s != null ? `${Math.floor((r.moving_time_s || 0) / 60)} min` : "—"}
                  </span>
                  <span>
                    {r.distance_m != null ? `${((r.distance_m || 0) / 1000).toFixed(1)} km` : "—"}
                  </span>
                  <span>HR: {r.average_heartrate_bpm ?? "—"}</span>
                </div>
              </button>
            );
          })}
        {!loading && !rows.length && (
          <div className="text-center opacity-70 py-4">Žiadne aktivity.</div>
        )}
      </div>

      {/* DESKTOP */}
      <div className="hidden sm:block overflow-x-auto">
        <div style={{ minWidth: THEME.layout.tableMinWidth }}>
          <table className="w-full text-sm border-collapse text-center">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th>Date</th>
                <th>Sport</th>
                <th>Name</th>
                <th>Time</th>
                <th>Avg HR</th>
                <th>Max HR</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">
                    Načítavam…
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const eff = toEffSport(r);
                  return (
                    <tr
                      key={r.activity_id}
                      className="cursor-pointer border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setSelectedId(r.activity_id)}
                      title={r.name}
                    >
                      <td>{new Date(r.date).toLocaleDateString("sk-SK")}</td>
                      <td>{sportUiLabel(eff)}</td>
                      <td className="truncate max-w-[260px]">{r.name}</td>
                      <td>{r.moving_time_s != null ? fmtSecondsHMS(r.moving_time_s) : "—"}</td>
                      <td>{r.average_heartrate_bpm ?? "—"}</td>
                      <td>{r.max_heartrate_bpm ?? "—"}</td>
                      <td>
                        {r.distance_m != null ? `${((r.distance_m || 0) / 1000).toFixed(2)} km` : "—"}
                      </td>
                    </tr>
                  );
                })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">
                    {start && end
                      ? "Žiadne aktivity zvoleného športu v tomto období."
                      : "Klikni na týždeň v grafe, aby sa zobrazili aktivity."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedId != null && (
        <div className={SUBCARD}>
          <ActivityDetail activityId={selectedId} />
        </div>
      )}
    </div>
  );
}