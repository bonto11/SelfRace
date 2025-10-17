"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

interface Metrics {
  weight_kg: number | null;
  body_fat_pct: number | null;
  HR_max: number | null;
  RHR: number | null;
  VO2Max: number | null;
}

export default function TableMetrics() {
  const { userId } = useUserId();
  const [metrics, setMetrics] = useState<Metrics>({
    weight_kg: null,
    body_fat_pct: null,
    HR_max: null,
    RHR: null,
    VO2Max: null,
  });

  async function handleSave() {
    if (!userId) return;
    const res = await fetch(`${API_URL}/profile/metrics/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...metrics }),
    });
    const json = await res.json();
    if (json.success) alert("✅ Metrics uložené");
    else alert("❌ Chyba: " + json.detail);
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-2">Metrics</h2>
      <table className="w-full text-sm border-collapse text-center">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th>Weight (kg)</th>
            <th>Body fat %</th>
            <th>HR max</th>
            <th>RHR</th>
            <th>VO₂Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <input
                type="number"
                value={metrics.weight_kg ?? ""}
                onChange={(e) =>
                  setMetrics({ ...metrics, weight_kg: Number(e.target.value) })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full text-center"
              />
            </td>
            <td>
              <input
                type="number"
                value={metrics.body_fat_pct ?? ""}
                onChange={(e) =>
                  setMetrics({
                    ...metrics,
                    body_fat_pct: Number(e.target.value),
                  })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full text-center"
              />
            </td>
            <td>
              <input
                type="number"
                value={metrics.HR_max ?? ""}
                onChange={(e) =>
                  setMetrics({ ...metrics, HR_max: Number(e.target.value) })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full text-center"
              />
            </td>
            <td>
              <input
                type="number"
                value={metrics.RHR ?? ""}
                onChange={(e) =>
                  setMetrics({ ...metrics, RHR: Number(e.target.value) })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full text-center"
              />
            </td>
            <td>
              <input
                type="number"
                value={metrics.VO2Max ?? ""}
                onChange={(e) =>
                  setMetrics({ ...metrics, VO2Max: Number(e.target.value) })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full text-center"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Save new entry
        </button>
      </div>
    </div>
  );
}
