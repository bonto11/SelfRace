"use client";

import { useState, useEffect } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";

export default function RecoveryForm() {
  const { userId, loading } = useUserId();

  // vstupné polia
  const [rhr, setRhr] = useState<number | "">("");
  const [hrvAvg, setHrvAvg] = useState<number | "">("");
  const [hrvMax, setHrvMax] = useState<number | "">("");
  const [sleepDuration, setSleepDuration] = useState<number | "">("");
  const [sleepStart, setSleepStart] = useState<string>(""); // ISO string
  const [alcoholVolume, setAlcoholVolume] = useState<number | "">("");
  const [alcoholType, setAlcoholType] = useState<number | "">("");
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [comment, setComment] = useState("");

  // ⏰ Nastavíme default na včerajší deň o 23:00
  useEffect(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 0, 0, 0); // 23:00:00

    // pre input typu datetime-local musíme dať formát YYYY-MM-DDTHH:MM
    const formatted = yesterday.toISOString().slice(0, 16);
    setSleepStart(formatted);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      alert("❌ Užívateľ neznámy.");
      return;
    }

    const payload = {
      user_id: userId,
      RHR_bpm: rhr,
      HRV_avg_ms: hrvAvg,
      HRV_max_ms: hrvMax,
      sleep_duration_min: sleepDuration,
      sleep_start_timestampz: sleepStart,
      alcohol_volume_ml: alcoholVolume,
      alcohol_type_pct: alcoholType,
      food_2h_before: lateFood,
      caffeine_8h: lateCaffeine,
      comment,
    };

    console.log("➡️ Ukladám recovery:", payload);

    const res = await fetch(`${API_URL}/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      alert("Chyba: " + json.error);
    } else {
      alert("Záznam uložený ✅");
    }
  }

  if (loading) return <div>Načítavam...</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded shadow"
    >
      {/* ostatné inputy */}

      <label className="block">Sleep start</label>
      <input
        type="datetime-local"
        value={sleepStart}
        onChange={(e) => setSleepStart(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <button
        type="submit"
        disabled={!userId}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
