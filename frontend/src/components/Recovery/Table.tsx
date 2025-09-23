"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";
import Columns from "./Columns";

interface RecoveryRow {
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_start_time: string | null;
  sleep_duration_min: number | null;
  food_2h_before: boolean;
  caffeine_8h: boolean;
  alcohol_volume_ml: number | null;
  alcohol_type_pct: number | null;
  comments: string | null;
}

export default function RecoveryHistory() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/recovery/${userId}`);
      const json = await res.json();
      if (json.success) {
        setRows(json.data);
      } else {
        console.error("❌ Backend error:", json);
      }
    } catch (err) {
      console.error("❌ Fetch error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  if (!userId) return <div>❌ User not found.</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mt-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold">Recovery History</h2>
        <button
          onClick={load}
          disabled={loading}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && (
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
          )}
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse text-center">
          <Columns />
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700">
              <th>Date</th>
              <th>RHR</th>
              <th>HRV avg</th>
              <th>HRV max</th>
              <th>Sleep duration</th>
              <th>Sleep start</th>   
              <th>Food?</th>
              <th>Caffeine?</th>
              <th>Alcohol (ml)</th>
              <th>Alc. %</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-t border-gray-300 dark:border-gray-700"
              >
                <td>{r.date}</td>
                <td>{r.RHR_bpm ?? "-"}</td>
                <td>{r.HRV_avg_ms ?? "-"}</td>
                <td>{r.HRV_max_ms ?? "-"}</td>  
                <td>
                  {r.sleep_duration_min
                    ? `${Math.floor(r.sleep_duration_min / 60)}h ${
                        r.sleep_duration_min % 60
                      }m`
                    : "-"}
                </td>
                <td>{r.sleep_start_time ?? "-"}</td>
                <td>{r.food_2h_before ? "✓" : "✗"}</td>
                <td>{r.caffeine_8h ? "✓" : "✗"}</td>
                <td>{r.alcohol_volume_ml ?? "-"}</td>
                <td>{r.alcohol_type_pct ?? "-"}</td>
                <td className="truncate max-w-[200px]" title={r.comments ?? ""}>
                  {r.comments ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}