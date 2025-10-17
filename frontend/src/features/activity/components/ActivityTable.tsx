// src/features/activity/components/ActivityTable.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { API_URL } from "@/shared/config";
import { SUBCARD, CARD } from "@/shared/ui/classes";
import { toEffSport, sportUiLabel } from "@/features/activity/utils/sport";
import { THEME } from "@/shared/theme/tokens";

interface ActivityRow {
  activity_id: number;
  name: string;
  sport_type?: string | null;
  sport_type_fe?: string | null;
  sport_type_ovrd?: string | null;
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

export default function ActivityTable({
  start,
  end,
}: {
  start?: string;
  end?: string;
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ActivityDetail | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    setSelected(null);
    setNote("");
  }, [start, end]);

  async function load() {
    if (!userId) return;
    if (!start || !end) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const url = `${API_URL}/activities/range/${userId}?start=${start}&end=${end}`;
      const res = await fetch(url);
      const json = await res.json().catch(() => ({}));
      setRows(json?.success ? json.data ?? [] : []);
    } catch (err) {
      console.error("❌ [FE] Fetch error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, start, end]);

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_URL}/activities/sync/${userId}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        alert(
          `✅ Sync OK.\nimported: ${json.imported ?? "?"}\nupdated: ${
            json.updated ?? "?"
          }`
        );
        await load();
      } else {
        alert("❌ Sync error: " + (json?.detail || "unknown"));
      }
    } catch (err) {
      console.error("❌ [FE] Sync request error:", err);
      alert("❌ Sync request error (pozri konzolu).");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSelect(activityId: number) {
    try {
      const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success) {
        setSelected({
          summary: json.summary ?? json.data,
          laps: Array.isArray(json.laps) ? json.laps : [],
          splits: Array.isArray(json.splits) ? json.splits : [],
        });
        const noteRes = await fetch(`${API_URL}/notes/${userId}/${activityId}`);
        const noteJson = await noteRes.json().catch(() => ({}));
        setNote(noteJson?.data?.feeling || "");
      }
    } catch (err) {
      console.error("❌ [FE] Fetch detail error:", err);
    }
  }

  if (!userId) return <div>❌ User not found.</div>;

  const headerTitle =
    start && end
      ? `História (${start} → ${end})`
      : "História (vyber týždeň v grafe vyššie)";

  return (
    <div className={`${CARD} space-y-4`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">{headerTitle}</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          )}
          {syncing ? "Synchronizujem..." : "Sync Strava"}
        </button>
      </div>
 
      {/* MOBILE: karty */}
      <div className="sm:hidden space-y-2">
        {loading && <div className="opacity-70 py-4">Načítavam…</div>}
        {!loading &&
          rows.map((row) => {
            const eff = toEffSport(row);
            return (
              <button
                key={row.activity_id}
                onClick={() => handleSelect(row.activity_id)}
                className="w-full text-left rounded border border-gray-700 p-3 bg-gray-900"
                title={row.name}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {new Date(row.date).toLocaleDateString("sk-SK")}
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded bg-gray-700">
                    {sportUiLabel(eff)}
                  </div>
                </div>
                <div className="truncate opacity-90">{row.name}</div>
                <div className="mt-1 text-xs opacity-75 flex gap-3">
                  <span>
                    {row.moving_time_s != null
                      ? `${Math.floor((row.moving_time_s || 0) / 60)} min`
                      : "—"}
                  </span>
                  <span>
                    {row.distance_m != null
                      ? `${((row.distance_m || 0) / 1000).toFixed(1)} km`
                      : "—"}
                  </span>
                  <span>HR: {row.average_heartrate_bpm ?? "—"}</span>
                </div>
              </button>
            );
          })}
        {!loading && !rows.length && (
          <div className="text-center opacity-70 py-4">Žiadne aktivity.</div>
        )}
      </div>

      {/* DESKTOP/LANDSCAPE: tabuľka */}
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
                rows.map((row) => {
                  const eff = toEffSport(row);
                  return (
                    <tr
                      key={row.activity_id}
                      className="cursor-pointer border-t border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => handleSelect(row.activity_id)}
                      title={row.name}
                    >
                      <td>{new Date(row.date).toLocaleDateString("sk-SK")}</td>
                      <td>{sportUiLabel(eff)}</td>
                      <td className="truncate max-w-[250px]">{row.name}</td>
                      <td>
                        {row.moving_time_s != null
                          ? `${Math.floor((row.moving_time_s || 0) / 60)} min`
                          : "—"}
                      </td>
                      <td>{row.average_heartrate_bpm ?? "—"}</td>
                      <td>{row.max_heartrate_bpm ?? "—"}</td>
                      <td>
                        {row.distance_m != null
                          ? `${((row.distance_m || 0) / 1000).toFixed(2)} km`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={7} className="py-6 opacity-70">
                    {start && end
                      ? "Žiadne aktivity v tomto období."
                      : "Klikni na týždeň v grafe, aby sa zobrazili aktivity."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL + NOTE */}
      {selected && (
        <div className={SUBCARD}>
          <h3 className="font-bold mb-2">
            {selected.summary.name} (
            {new Date(selected.summary.date).toLocaleDateString("sk-SK")})
          </h3>

          <p>Sport: {sportUiLabel(toEffSport(selected.summary))}</p>
          <p>
            Distance:{" "}
            {selected.summary.distance_m != null
              ? (selected.summary.distance_m / 1000).toFixed(2) + " km"
              : "—"}
          </p>
          <p>
            Moving time:{" "}
            {selected.summary.moving_time_s != null
              ? Math.floor(selected.summary.moving_time_s / 60) + " min"
              : "—"}
          </p>
          <p>Avg HR: {selected.summary.average_heartrate_bpm ?? "—"}</p>
          <p>Max HR: {selected.summary.max_heartrate_bpm ?? "—"}</p>

          {selected.laps?.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Laps</h4>
              <ul className="list-disc pl-5">
                {selected.laps.map((lap, idx) => (
                  <li key={lap.lap_index ?? idx}>
                    Lap {lap.lap_index}: {lap.distance_m} m, {lap.moving_time_s}
                    s
                  </li>
                ))}
              </ul>
            </>
          )}
          {selected.splits?.length > 0 && (
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

          <div className="mt-4">
            <label className="block font-bold mb-1">Feeling / poznámka</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-800"
              placeholder="Ako sa ti bežalo?"
            />
            <button
              onClick={async () => {
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
                  const json = await res.json().catch(() => ({}));
                  if (res.ok && json?.success) alert("✅ Poznámka uložená");
                  else alert("❌ Chyba pri ukladaní poznámky");
                } catch (e) {
                  console.error(e);
                  alert("❌ Chyba pri ukladaní poznámky (pozri konzolu).");
                }
              }}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Uložiť poznámku
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
