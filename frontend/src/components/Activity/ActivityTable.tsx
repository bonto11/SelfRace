// src/components/Activity/ActivityTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";

type DateRange = { start: string; end: string } | null;

interface ActivityRow {
  activity_id: number;
  name: string;
  sport_type: string;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  date: string; // ISO
}

interface ActivityDetail {
  summary: ActivityRow;
  laps: any[];
  splits: any[];
}

function fmtMin(totalSec?: number | null) {
  if (!totalSec) return "-";
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
function fmtKm(m?: number | null) {
  if (!m) return "-";
  return (m / 1000).toFixed(2) + " km";
}
function safeDateOnly(iso: string) {
  // vyrež len YYYY-MM-DD a sprav si “poludnie”, aby TZ neskreslila filter
  return (iso || "").slice(0, 10) + "T12:00:00";
}

export default function ActivityTable({ filterRange }: { filterRange: DateRange }) {
  const { userId, loading: userLoading } = useUserId();

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ActivityDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string>("");

  // 🔄 načítanie aktivít
  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/activities/${userId}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        // zoradíme najnovšie hore
        const sorted: ActivityRow[] = [...json.data].sort(
          (a: ActivityRow, b: ActivityRow) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setRows(sorted);
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error("❌ [FE] Fetch activities error:", err);
      setRows([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  // 🗂️ lokálny filter podľa týždňa z grafu
  const filteredRows = useMemo(() => {
    if (!filterRange) return rows;
    try {
      const s = new Date(filterRange.start + "T00:00:00");
      const e = new Date(filterRange.end + "T23:59:59");
      const out = rows.filter((r) => {
        const d = new Date(safeDateOnly(r.date));
        return d >= s && d <= e;
      });
      // malý debug do konzoly
      console.debug(
        "[ActivityTable] filterRange",
        filterRange,
        "→", out.length, "záznamov"
      );
      return out;
    } catch {
      return rows;
    }
  }, [rows, filterRange]);

  // 🖱️ detail
  async function handleSelect(activityId: number) {
    try {
      const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
      const json = await res.json();
      if (json.success) {
        setSelected(json);

        const noteRes = await fetch(`${API_URL}/notes/${userId}/${activityId}`);
        const noteJson = await noteRes.json();
        setNote(noteJson.data?.feeling || "");
      }
    } catch (err) {
      console.error("❌ [FE] Fetch detail error:", err);
    }
  }

  // 🔘 sync
  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/activities/sync/${userId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) await load();
    } catch (err) {
      console.error("❌ [FE] Sync error:", err);
    }
    setSyncing(false);
  }

  // 💾 poznámka
  async function handleSaveNote() {
    if (!userId || !selected) return;
    try {
      const res = await fetch(`${API_URL}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          activity_id: selected.summary.activity_id,
          feeling: note,
        }),
      });
      const json = await res.json();
      if (!json.success) alert("❌ Chyba pri ukladaní poznámky");
    } catch (err) {
      console.error("❌ [FE] Save note error:", err);
    }
  }

  if (userLoading || loading) return <div>Načítavam...</div>;
  if (!userId) return <div>❌ User not found.</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">
          Activities{filterRange ? (
            <span className="ml-2 text-xs font-normal opacity-70">
              – filter: {filterRange.start} – {filterRange.end}
            </span>
          ) : null}
        </h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {syncing ? "Synchronizujem..." : "Sync"}
        </button>
      </div>

      {/* TABUĽKA */}
      <div className="overflow-x-auto">
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
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 opacity-70">
                  Žiadne aktivity pre zvolený interval.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.activity_id}
                  className="cursor-pointer border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSelect(row.activity_id)}
                >
                  <td>{new Date(row.date).toLocaleDateString("sk-SK")}</td>
                  <td>{row.sport_type}</td>
                  <td className="truncate max-w-[220px]" title={row.name}>
                    {row.name}
                  </td>
                  <td>{fmtMin(row.moving_time_s)}</td>
                  <td>{row.average_heartrate_bpm ?? "-"}</td>
                  <td>{row.max_heartrate_bpm ?? "-"}</td>
                  <td>{fmtKm(row.distance_m)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL */}
      {selected && (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded shadow">
          <h3 className="font-bold mb-2">
            {selected.summary.name} (
            {new Date(selected.summary.date).toLocaleDateString("sk-SK")})
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-1 gap-x-4 text-sm">
            <div><b>Sport:</b> {selected.summary.sport_type}</div>
            <div><b>Distance:</b> {fmtKm(selected.summary.distance_m)}</div>
            <div><b>Moving time:</b> {fmtMin(selected.summary.moving_time_s)}</div>
            <div><b>Avg HR:</b> {selected.summary.average_heartrate_bpm ?? "-"}</div>
            <div><b>Max HR:</b> {selected.summary.max_heartrate_bpm ?? "-"}</div>
          </div>

          {/* NOTE */}
          <div className="mt-4">
            <label className="block font-bold mb-1">Feeling / poznámka</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800"
              placeholder="Ako sa ti bežalo?"
            />
            <button
              onClick={handleSaveNote}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Uložiť poznámku
            </button>
          </div>

          {selected.laps?.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Laps</h4>
              <ul className="list-disc pl-5">
                {selected.laps.map((lap: any, idx: number) => (
                  <li key={lap.lap_index ?? idx}>
                    Lap {lap.lap_index}: {lap.distance_m} m, {lap.moving_time_s}s
                  </li>
                ))}
              </ul>
            </>
          )}

          {selected.splits?.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Splits</h4>
              <ul className="list-disc pl-5">
                {selected.splits.map((split: any, idx: number) => (
                  <li key={split.split_index ?? idx}>
                    Split {split.split_index}: {split.distance_m} m, {split.moving_time_s}s
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}