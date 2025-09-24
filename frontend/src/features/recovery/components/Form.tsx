"use client";

import { useState } from "react";
import { useUserId } from "@/shared/hooks/useUserId";
import { API_URL } from "@/shared/config";
import Columns from "./Columns";

export default function RecoveryForm() {
  const { userId } = useUserId();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rhr, setRhr] = useState("");
  const [hrvAvg, setHrvAvg] = useState("");
  const [hrvMax, setHrvMax] = useState("");
  const [sleepStart, setSleepStart] = useState("");
  const [sleepDuration, setSleepDuration] = useState("");
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [alcoholVolume, setAlcoholVolume] = useState("");
  const [alcoholType, setAlcoholType] = useState("");
  const [comments, setComment] = useState("");

  function handleTimeInput(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) {
    let value = e.target.value.replace(/\D/g, ""); // odstráni nečíselné znaky

    if (value.length >= 3) {
      value = value.slice(0, 2) + ":" + value.slice(2, 4);
    }
    setter(value);
  }

  async function handleSave() {
    if (!userId) return alert("❌ Užívateľ neznámy");

    let sleepMinutes: number | null = null;
    if (sleepDuration) {
      const [h, m] = sleepDuration.split(":").map(Number);
      sleepMinutes = h * 60 + m;
    }

    const payload = {
      user_id: userId,
      date,
      RHR_bpm: rhr ? Number(rhr) : null,
      HRV_avg_ms: hrvAvg ? Number(hrvAvg) : null,
      HRV_max_ms: hrvMax ? Number(hrvMax) : null,
      sleep_start_time: sleepStart,
      sleep_duration_min: sleepMinutes,
      food_2h_before: lateFood,
      caffeine_8h: lateCaffeine,
      alcohol_volume_ml: alcoholVolume ? Number(alcoholVolume) : null,
      alcohol_type_pct: alcoholType ? Number(alcoholType) : null,
      comments,
    };

    const res = await fetch(`${API_URL}/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      alert("❌ Chyba: " + json.error);
    } else {
      alert("✅ Recovery uložené");
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <h2 className="text-lg font-bold mb-2">Recovery Inputs</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
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
            <tr className="bg-gray-100 dark:bg-gray-700">
              <td>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={rhr}
                  onChange={(e) => setRhr(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={hrvAvg}
                  onChange={(e) => setHrvAvg(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={hrvMax}
                  onChange={(e) => setHrvMax(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={sleepDuration}
                  onChange={(e) => handleTimeInput(e, setSleepDuration)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="text"
                  placeholder="HH:MM"
                  value={sleepStart}
                  onChange={(e) => handleTimeInput(e, setSleepStart)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={lateFood}
                  onChange={(e) => setLateFood(e.target.checked)}
                />
              </td>
              <td className="text-center">
                <input
                  type="checkbox"
                  checked={lateCaffeine}
                  onChange={(e) => setLateCaffeine(e.target.checked)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={alcoholVolume}
                  onChange={(e) => setAlcoholVolume(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={alcoholType}
                  onChange={(e) => setAlcoholType(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={comments}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-600"
                />
              </td>
            </tr>
            <tr>
              <td colSpan={11} className="text-right py-2">
                <button
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
