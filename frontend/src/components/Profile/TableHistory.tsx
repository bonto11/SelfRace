"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";

interface MetricsRow {
  id: number;
  user_id: number;
  weight_kg: number | null;
  body_fat_pct: number | null;
  HR_max: number | null;
  RHR: number | null;
  VO2Max: number | null;
  updated_at: string;
}

export default function TableHistory() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<MetricsRow[]>([]);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const res = await fetch(`${API_URL}/profile/metrics/history/${userId}`);
      const json = await res.json();
      if (json.success) setRows(json.data);
    }
    load();
  }, [userId]);

  if (!userId) return <div>❌ User not found</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-2">Metrics History</h2>
      <table className="w-full text-sm text-center border-collapse">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th>Date</th>
            <th>Weight (kg)</th>
            <th>Body fat %</th>
            <th>HR max</th>
            <th>RHR</th>
            <th>VO₂Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {new Date(r.updated_at).toLocaleString("sk-SK", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              <td>{r.weight_kg ?? "-"}</td>
              <td>{r.body_fat_pct ?? "-"}</td>
              <td>{r.HR_max ?? "-"}</td>
              <td>{r.RHR ?? "-"}</td>
              <td>{r.VO2Max ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}