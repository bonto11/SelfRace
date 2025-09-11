"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";

interface StaticProfile {
  sex: "M" | "F" | null;
  birth_date: string | null;
  height_cm: number | null;
}

export default function TableStatic() {
  const { userId, loading } = useUserId();
  const [staticData, setStaticData] = useState<StaticProfile>({
    sex: null,
    birth_date: null,
    height_cm: null,
  });

  useEffect(() => {
    if (!userId) return;
    async function load() {
      const res = await fetch(`${API_URL}/profile/static/${userId}`);
      const json = await res.json();
      if (json.success) setStaticData(json.data);
    }
    load();
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    const res = await fetch(`${API_URL}/profile/static/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...staticData }),
    });
    const json = await res.json();
    if (json.success) alert("✅ Static profile uložený");
    else alert("❌ Chyba: " + json.detail);
  }

  if (loading) return <div>Načítavam...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-6">
      <h2 className="text-lg font-bold mb-2">Static Profile</h2>
      <table className="w-full text-sm border-collapse text-center">
        <thead>
          <tr className="bg-gray-200 dark:bg-gray-700">
            <th>Sex</th>
            <th>Birth date</th>
            <th>Height (cm)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <select
                value={staticData.sex ?? ""}
                onChange={(e) =>
                  setStaticData({
                    ...staticData,
                    sex: e.target.value as "M" | "F",
                  })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full"
              >
                <option value="">-</option>
                <option value="M">Muž</option>
                <option value="F">Žena</option>
              </select>
            </td>
            <td>
              <input
                type="date"
                value={staticData.birth_date ?? ""}
                onChange={(e) =>
                  setStaticData({ ...staticData, birth_date: e.target.value })
                }
                className="bg-gray-100 dark:bg-gray-900 border p-1 rounded w-full"
              />
            </td>
            <td>
              <input
                type="number"
                value={staticData.height_cm ?? ""}
                onChange={(e) =>
                  setStaticData({
                    ...staticData,
                    height_cm: Number(e.target.value),
                  })
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
          Save
        </button>
      </div>
    </div>
  );
}