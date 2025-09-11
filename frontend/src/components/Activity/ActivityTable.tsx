"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";

interface ActivityRow {
  activity_id: number;
  name: string;
  sport_type: string;
  distance_m: number | null;
  moving_time_s: number | null;
  average_heartrate_bpm: number | null;
  max_heartrate_bpm: number | null;
  date: string;
}

interface ActivityDetail {
  summary: ActivityRow;
  laps: any[];
  splits: any[];
}

export default function ActivityTable() {
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
      if (json.success) setRows(json.data);
    } catch (err) {
      console.error("❌ [FE] Fetch error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userId) load();
  }, [userId]);

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
      console.error("❌ [FE] Chyba pri sync requeste:", err);
    }
    setSyncing(false);
  }

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
      if (!json.success) {
        alert("❌ Chyba pri ukladaní poznámky");
      } else {
        alert("✅ Poznámka uložená");
      }
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
        <h2 className="text-lg font-bold">Activities</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
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
            {rows.map((row, idx) => (
              <tr
                key={row.activity_id ?? idx}
                className="cursor-pointer border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSelect(row.activity_id)}
              >
                <td>{new Date(row.date).toLocaleDateString("sk-SK")}</td>
                <td>{row.sport_type}</td>
                <td className="truncate max-w-[200px]" title={row.name}>
                  {row.name}
                </td>
                <td>
                  {row.moving_time_s
                    ? Math.floor(row.moving_time_s / 60) + " min"
                    : "-"}
                </td>
                <td>{row.average_heartrate_bpm ?? "-"}</td>
                <td>{row.max_heartrate_bpm ?? "-"}</td>
                <td>
                  {row.distance_m
                    ? (row.distance_m / 1000).toFixed(2) + " km"
                    : "-"}
                </td>
              </tr>
            ))}
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

          <p>Sport: {selected.summary.sport_type}</p>
          <p>
            Distance:{" "}
            {selected.summary.distance_m
              ? (selected.summary.distance_m / 1000).toFixed(2) + " km"
              : "-"}
          </p>
          <p>
            Moving time:{" "}
            {selected.summary.moving_time_s
              ? Math.floor(selected.summary.moving_time_s / 60) + " min"
              : "-"}
          </p>
          <p>Avg HR: {selected.summary.average_heartrate_bpm ?? "-"}</p>
          <p>Max HR: {selected.summary.max_heartrate_bpm ?? "-"}</p>

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

          {selected.laps.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Laps</h4>
              <ul className="list-disc pl-5">
                {selected.laps.map((lap, idx) => (
                  <li key={lap.lap_index ?? idx}>
                    Lap {lap.lap_index}: {lap.distance_m} m,{" "}
                    {lap.moving_time_s}s
                  </li>
                ))}
              </ul>
            </>
          )}

          {selected.splits.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Splits</h4>
              <ul className="list-disc pl-5">
                {selected.splits.map((split, idx) => (
                  <li key={split.split_index ?? idx}>
                    Split {split.split_index}: {split.distance_m} m,{" "}
                    {split.moving_time_s}s
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