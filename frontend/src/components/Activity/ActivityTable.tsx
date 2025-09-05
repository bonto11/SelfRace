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

  //nacitanie aktivit
  useEffect(() => {
    async function load() {
      console.log("➡️ [FE] Načítavam aktivity pre userId =", userId);
      try {
        const res = await fetch(`${API_URL}/activities/${userId}`);
        const json = await res.json();

        if (json.success) {
          setRows(json.data);
        } else {
          console.error("❌ [FE] Backend error JSON:", json);
        }
      } catch (err) {
        console.error("❌ [FE] Fetch error:", err);
      }
      setLoading(false);
    }
    if (userId) load();
  }, [userId]);

  async function handleSelect(activityId: number) {
    console.log("🖱️ [FE] Klik na aktivitu, posielam activityId =", activityId);
    try {
      const res = await fetch(`${API_URL}/activities/detail/${activityId}`);
      console.log("➡️ [FE] GET detail status =", res.status);
      const json = await res.json();
      console.log("➡️ [FE] GET detail JSON =", json);

      if (json.success) {
        setSelected(json);
        console.log("✅ [FE] Uložený detail aktivity");
      } else {
        console.error("❌ [FE] Chyba detail JSON:", json);
      }
    } catch (err) {
      console.error("❌ [FE] Fetch detail error:", err);
    }
  }


  if (userLoading || loading) return <div>Načítavam...</div>;
  if (!userId) return <div>❌ User not found.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Posledný mesiac aktivít</h2>

      {/* TABUĽKA ZOZNAMU */}
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
            {rows.map((row, idx) => (
              <tr
                key={row.activity_id ?? idx}
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

      {/* DETAIL AKTIVITY */}
      {selected && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="font-bold mb-2">
            Detail aktivity: {selected.summary.name} (
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
