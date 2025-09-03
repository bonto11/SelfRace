"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";

interface RecoveryRow {
  id: number;
  date: string;
  RHR_bpm: number | null;
  HRV_avg_ms: number | null;
  HRV_max_ms: number | null;
  sleep_duration_min: number | null;
  sleep_start_time: string | null;
  food_2h_before: boolean | null;
  caffeine_8h: boolean | null;
  alcohol_volume_ml: number | null;
  alcohol_type_pct: number | null;
  comments: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // 👈 fix 24h
  });
}

function formatMinutes(mins: number | null) {
  if (!mins) return "-";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function RecoveryTable() {
  const { userId, loading: userLoading } = useUserId();
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
            <th className="text-center">Date</th>
            <th className="text-center">RHR</th>
            <th className="text-center">HRV avg</th>
            <th className="text-center">HRV max</th>
            <th className="text-center">Sleep start</th>
            <th className="text-center">Sleep (hh:mm)</th>
            <th className="text-center">Late food?</th>
            <th className="text-center">Late caffeine?</th>
            <th className="text-center">Alcohol consumed</th>
            <th className="text-center">Alcohol type</th>
            <th className="text-center">Comment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="text-center">{formatDate(row.date)}</td>
              <td className="text-center">{row.RHR_bpm ?? "-"}</td>
              <td className="text-center">{row.HRV_avg_ms ?? "-"}</td>
              <td className="text-center">{row.HRV_max_ms ?? "-"}</td>
              <td className="text-center">{row.sleep_start_time}
              </td>
              <td className="text-center">
                {formatMinutes(row.sleep_duration_min)}
              </td>
              <td className="text-center">{row.food_2h_before ? "✅" : "❌"}</td>
              <td className="text-center">{row.caffeine_8h ? "✅" : "❌"}</td>
              <td className="text-center">{row.alcohol_volume_ml ?? "-"}</td>
              <td className="text-center">{row.alcohol_type_pct ?? "-"}</td>
              <td className="text-center">{row.comments ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
