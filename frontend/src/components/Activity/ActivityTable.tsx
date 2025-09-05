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

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API_URL}/activities/${userId}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
      setLoading(false);
    }
    if (userId) load();
  }, [userId]);

  async function handleSelect(activityId: number) {
    console.log("➡️ Klik na aktivitu:", activityId);

    const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
    const json = await res.json();
    if (json.success) {
      setSelected(json.data);
    }
  }

  if (userLoading || loading) return <div>Načítavam...</div>;
  if (!userId) return <div>❌ User not found.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Posledný mesiac aktivít</h2>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="w-full text-sm">
          <thead>
            <tr>
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
            {rows.map((row) => (
              <tr
                key={row.activity_id}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSelect(row.activity_id)}
              >
                <td>{new Date(row.date).toLocaleDateString("sk-SK")}</td>
                <td>{row.sport_type}</td>
                <td>{row.name}</td>
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

      {selected && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="font-bold mb-2">
            Detail: {selected.summary.name} (
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

          {selected.laps.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Laps</h4>
              <table className="w-full text-sm border">
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th>Distance (m)</th>
                    <th>Time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.laps.map((lap, idx) => (
                    <tr key={idx}>
                      <td>{lap.lap_index}</td>
                      <td>{lap.distance_m}</td>
                      <td>{lap.moving_time_s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {selected.splits.length > 0 && (
            <>
              <h4 className="font-bold mt-4">Splits</h4>
              <table className="w-full text-sm border">
                <thead>
                  <tr>
                    <th>Split</th>
                    <th>Distance (m)</th>
                    <th>Time (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.splits.map((split, idx) => (
                    <tr key={idx}>
                      <td>{split.split_index}</td>
                      <td>{split.distance_m}</td>
                      <td>{split.moving_time_s}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
