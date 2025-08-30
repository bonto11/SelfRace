"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/lib/useUserId"; // 👈 import hook
import { API_URL } from "@/lib/config";

interface RecoveryRow {
  id: number;
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_duration_min: number | null;
  sleep_start_timestampz: string | null;
  food_2h_before: boolean | null;
  caffeine_8h: boolean | null;
  alcohol_volume_ml: number | null;
  alcohol_type_pct: number | null;
  comment: string | null;
}

export default function RecoveryTable() {
  const { userId, loading: userLoading } = useUserId(); // 👈 získa userId
  const [rows, setRows] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  async function load() {
    console.log("➡️ Načítavam recovery pre user:", userId);
    const res = await fetch(`${API_URL}/recovery/${userId}`);
    const json = await res.json();

    if (!json.success) {
      console.error("Chyba pri načítaní recovery:", json.error);
    } else {
      setRows(json.data);
    }
    setLoading(false);
  }
  if (userId) load();
}, [userId]);

  if (userLoading || loading) return <div>Načítavam...</div>;
  if (!userId) return <div>❌ User not found.</div>;
  if (!rows.length) return <div>Žiadne recovery dáta.</div>;

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Date</th>
            <th>RHR</th>
            <th>HRV avg</th>
            <th>HRV max</th>
            <th>Sleep start</th>
            <th>Sleep (min)</th>
            <th>Late food?</th>
            <th>Late caffeine?</th>
            <th>Alcohol consumed</th>
            <th>Alcohol type</th>
            <th>Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.RHR_bpm ?? "-"}</td>
              <td>{row.HRV_avg_ms ?? "-"}</td>
              <td>{row.HRV_max_ms ?? "-"}</td>
              <td>{row.sleep_start_timestampz ?? "-"}</td>
              <td>{row.sleep_duration_min ?? "-"}</td>
              <td>{row.food_2h_before ? "✅" : "❌"}</td>
              <td>{row.caffeine_8h ? "✅" : "❌"}</td>
              <td>{row.alcohol_volume_ml ?? "-"}</td>
              <td>{row.alcohol_type_pct ?? "-"}</td>
              <td>{row.comment ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
