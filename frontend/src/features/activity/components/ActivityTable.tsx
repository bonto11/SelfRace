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

/* ---------------- helpers ---------------- */

function normSportsList(
  sel: string | string[] | null | undefined
): string[] | null {
  if (sel == null) return null; // žiadny filter -> všetko
  if (Array.isArray(sel)) {
    const arr = sel.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    if (arr.length === 0) return null;
    if (arr.length === 1 && arr[0] === "all") return null;
    return Array.from(new Set(arr));
  }
  const raw = String(sel).trim().toLowerCase();
  if (!raw || raw === "all") return null;
  const arr = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : null;
}

type Props = {
  start?: string;
  end?: string;
  /** môže byť "all" | "run" | "ride" | "run,ride" | ["run","ride"] | null */
  sport?: string | string[] | null;
  /** whitelist športov – ak je daný, zobraz iba tieto */
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
    () =>
      start && end
        ? `Týždeň ${start} → ${end}`
        : "História (vyber týždeň v grafe)",
    [start, end]
  );

  const sportList = useMemo(() => normSportsList(sport), [sport]);
  const filterLabel = useMemo(() => {
    if (!sportList) return "všetko";
    return sportList.map((s) => sportUiLabel(s)).join(" + ");
  }, [sportList]);

  useEffect(() => {
    setSelectedId(null);
    if (!start || !end) {
      setRows([]);
      return;
    }
    setLoading(true);

    // 1) všetky v rozsahu
    const inRange = selectByRange(start, end);

    // 2) whitelist (napr. pre 80/20 vyhodiť walk)
    const afterWhitelist =
      Array.isArray(allowedSports) && allowedSports.length
        ? inRange.filter((r) => allowedSports.includes(toEffSport(r)))
        : inRange;

    // 3) multi-sport filter z grafu (ak je daný)
    const finalRows = sportList
      ? afterWhitelist.filter((r) => sportList.includes(toEffSport(r)))
      : afterWhitelist;

    setRows(finalRows);
    setLoading(false);

    console.debug("[ACT][table] filter", {
      start,
      end,
      sport,
      sportList,
      allowedSports,
      allRows: allRows.length,
      inRange: inRange.length,
      afterWhitelist: afterWhitelist.length,
      final: finalRows.length,
      sample: finalRows
        .slice(0, 3)
        .map((r) => ({ id: r.activity_id, s: toEffSport(r) })),
    });
  }, [start, end, sportList, allowedSports, selectByRange, allRows.length]);

  return (
    <div className={`${CARD} space-y-4`}>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">{headerTitle}</h2>
        <div className="text-xs opacity-60">Filter: {filterLabel}</div>
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
                  <div className="text-xs px-2 py-0.5 rounded bg-gray-700">
                    {sportUiLabel(eff)}
                  </div>
                </div>
                <div className="truncate opacity-90">{r.name}</div>
                <div className="mt-1 text-xs opacity-75 flex gap-3">
                  <span>
                    {r.moving_time_s != null
                      ? `${Math.floor((r.moving_time_s || 0) / 60)} min`
                      : "—"}
                  </span>
                  <span>
                    {r.distance_m != null
                      ? `${((r.distance_m || 0) / 1000).toFixed(1)} km`
                      : "—"}
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
                      <td>
                        {r.moving_time_s != null
                          ? fmtSecondsHMS(r.moving_time_s)
                          : "—"}
                      </td>
                      <td>{r.average_heartrate_bpm ?? "—"}</td>
                      <td>{r.max_heartrate_bpm ?? "—"}</td>
                      <td>
                        {r.distance_m != null
                          ? `${((r.distance_m || 0) / 1000).toFixed(2)} km`
                          : "—"}
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
