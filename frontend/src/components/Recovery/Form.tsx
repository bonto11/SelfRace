"use client";

import { useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      alert("❌ Užívateľ neznámy.");
      return;
    }

  const payload = {
    user_id: userId,            // 👈 toto je int z DB
    RHR_bpm: rhr || null,
    HRV_avg_ms: hrvAvg || null,
    HRV_max_ms: hrvMax || null,
    sleep_duration_min: sleepDuration || null,
    sleep_start_timestampz: sleepStart ? `${sleepStart}:00Z` : null,
    alcohol_volume_ml: alcoholVolume || null,
    alcohol_type_pct: alcoholType || null,
    food_2h_before: lateFood,
    caffeine_8h: lateCaffeine,
    comment: comment || null,
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

      // reset formu
      setRhr("");
      setHrvAvg("");
      setHrvMax("");
      setSleepDuration("");
      setSleepStart("");
      setAlcoholVolume("");
      setAlcoholType("");
      setLateFood(false);
      setLateCaffeine(false);
      setComment("");
    }
  }

  if (loading) return <div>Načítavam...</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded shadow"
    >
      <input
        type="number"
        placeholder="Resting HR (bpm)"
        value={rhr}
        onChange={(e) => setRhr(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="HRV avg (ms)"
        value={hrvAvg}
        onChange={(e) => setHrvAvg(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="HRV max (ms)"
        value={hrvMax}
        onChange={(e) => setHrvMax(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="Sleep duration (min)"
        value={sleepDuration}
        onChange={(e) => setSleepDuration(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <label className="block">Sleep start</label>
      <input
        type="datetime-local"
        value={sleepStart}
        onChange={(e) => setSleepStart(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={lateFood}
          onChange={(e) => setLateFood(e.target.checked)}
        />
        <label>Food within 2h before sleep</label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={lateCaffeine}
          onChange={(e) => setLateCaffeine(e.target.checked)}
        />
        <label>Caffeine within 8h before sleep</label>
      </div>

      <input
        type="number"
        placeholder="Alcohol consumed (ml)"
        value={alcoholVolume}
        onChange={(e) => setAlcoholVolume(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="Alcohol type (%)"
        value={alcoholType}
        onChange={(e) => setAlcoholType(Number(e.target.value))}
        className="w-full p-2 border rounded"
      />

      <textarea
        placeholder="Comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
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
