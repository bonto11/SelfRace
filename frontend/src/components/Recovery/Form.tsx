"use client";

import { useState } from "react";
import { useUserId } from "@/lib/useUserId";
import { API_URL } from "@/lib/config";

export default function RecoveryForm() {
  const { userId, loading } = useUserId();

  // prednastavíme dnešný deň
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [rhr, setRhr] = useState("");
  const [hrvAvg, setHrvAvg] = useState("");
  const [hrvMax, setHrvMax] = useState("");
  const [sleepDuration, setSleepDuration] = useState(""); // HH:MM
  const [sleepStart, setSleepStart] = useState("");       // HH:MM
  const [alcoholVolume, setAlcoholVolume] = useState("");
  const [alcoholType, setAlcoholType] = useState("");
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [comment, setComment] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      alert("❌ Užívateľ neznámy.");
      return;
    }

    // spracovanie sleepDuration (HH:MM → minúty)
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
      sleep_duration_min: sleepMinutes,
      sleep_start_time: sleepStart,
      alcohol_volume_ml: alcoholVolume ? Number(alcoholVolume) : null,
      alcohol_type_pct: alcoholType ? Number(alcoholType) : null,
      food_2h_before: lateFood,
      caffeine_8h: lateCaffeine,
      comment,
    };

    console.log("➡️ Posielam recovery:", payload);

    const res = await fetch(`${API_URL}/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) {
      alert("Chyba: " + json.error);
    } else {
      alert("✅ Recovery uložené/aktualizované");
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded shadow"
    >
      <label className="block">Date</label>
      <input
        type="date"
        required
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="Resting HR (bpm)"
        required
        value={rhr}
        onChange={(e) => setRhr(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="HRV avg (ms)"
        value={hrvAvg}
        onChange={(e) => setHrvAvg(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="HRV max (ms)"
        value={hrvMax}
        onChange={(e) => setHrvMax(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <label className="block">Sleep duration (HH:MM)</label>
      <input
        type="text"
        required
        placeholder="napr. 07:45"
        pattern="^([01]\d|2[0-3]):([0-5]\d)$"
        title="Zadajte čas vo formáte HH:MM (00–23:59)"
        value={sleepDuration}
        onChange={(e) => setSleepDuration(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <label className="block">Sleep start (HH:MM)</label>
      <input
        type="text"
        required
        placeholder="napr. 22:30"
        pattern="^([01]\d|2[0-3]):([0-5]\d)$"
        title="Zadajte čas vo formáte HH:MM (00–23:59)"
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
        onChange={(e) => setAlcoholVolume(e.target.value)}
        className="w-full p-2 border rounded"
      />

      <input
        type="number"
        placeholder="Alcohol type (%)"
        value={alcoholType}
        onChange={(e) => setAlcoholType(e.target.value)}
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
