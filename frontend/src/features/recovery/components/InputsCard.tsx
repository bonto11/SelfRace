// src/features/recovery/components/RecoveryInputsCard.tsx
"use client";

import { useState, useMemo } from "react";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput,} from "@/shared/utils/recovery";

export default function InputsCard() {
  const { userId } = useUserId();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState<string>(todayIso);
  const [rhr, setRhr] = useState("");
  const [hrvAvg, setHrvAvg] = useState("");
  const [hrvMax, setHrvMax] = useState("");
  const [sleepStart, setSleepStart] = useState("");
  const [sleepDuration, setSleepDuration] = useState("");
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [alcoholVolume, setAlcoholVolume] = useState("");
  const [alcoholType, setAlcoholType] = useState("");
  const [comments, setComments] = useState("");

  function shiftDate(deltaDays: number) {
    setDate((prev) => addDaysIso(prev, deltaDays));
  }

  async function handleSave() {
    if (!userId) return alert("❌ Užívateľ neznámy");

    let sleepMinutes: number | null = null;
    if (sleepDuration) {
      const [h, m] = sleepDuration.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) sleepMinutes = h * 60 + m;
    }

    const payload = {
      user_id: userId,
      date,
      RHR_bpm: rhr ? Number(rhr) : null,
      HRV_avg_ms: hrvAvg ? Number(hrvAvg) : null,
      HRV_max_ms: hrvMax ? Number(hrvMax) : null,
      sleep_start_time: sleepStart || null,
      sleep_duration_min: sleepMinutes,
      food_2h_before: lateFood,
      caffeine_8h: lateCaffeine,
      alcohol_volume_ml: alcoholVolume ? Number(alcoholVolume) : null,
      alcohol_type_pct: alcoholType ? Number(alcoholType) : null,
      comments,
    };

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Unknown error");
      alert("✅ Recovery uložené");
    } catch (e: any) {
      alert("❌ Chyba: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Recovery Inputs</h2>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            onClick={() => shiftDate(-1)}
            title="Predošlý deň"
          >
            −1d
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1 rounded bg-gray-700 text-sm"
          />
          <button
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
            onClick={() => shiftDate(+1)}
            title="Ďalší deň"
          >
            +1d
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* RHR */}
        <div className="p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-1">Resting HR</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={rhr}
              onChange={(e) => setRhr(e.target.value)}
              placeholder="bpm"
              className="flex-1 px-2 py-2 rounded bg-gray-700"
            />
            <span className="text-sm opacity-70">bpm</span>
          </div>
        </div>

        {/* HRV avg / max */}
        <div className="p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-1">HRV (RMSSD)</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={hrvAvg}
              onChange={(e) => setHrvAvg(e.target.value)}
              placeholder="avg ms"
              className="w-1/2 px-2 py-2 rounded bg-gray-700"
            />
            <input
              type="number"
              value={hrvMax}
              onChange={(e) => setHrvMax(e.target.value)}
              placeholder="max ms"
              className="w-1/2 px-2 py-2 rounded bg-gray-700"
            />
            <span className="text-sm opacity-70 hidden md:block">ms</span>
          </div>
        </div>

        {/* Sleep (duration | start) – vedľa seba */}
        <div className="md:col-span-2 p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-1">Sleep</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="HH:MM duration"
              value={sleepDuration}
              onChange={(e) => handleTimeInput(e, setSleepDuration)}
              className="px-2 py-2 rounded bg-gray-700"
            />
            <input
              type="text"
              placeholder="HH:MM start"
              value={sleepStart}
              onChange={(e) => handleTimeInput(e, setSleepStart)}
              className="px-2 py-2 rounded bg-gray-700"
            />
          </div>
        </div>

        {/* Evening factors */}
        <div className="p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-2">Evening factors</div>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={lateFood}
              onChange={(e) => setLateFood(e.target.checked)}
            />
            <span>Food ≤ 2h before bed</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lateCaffeine}
              onChange={(e) => setLateCaffeine(e.target.checked)}
            />
            <span>Caffeine ≤ 8h before bed</span>
          </label>
        </div>

        {/* Alcohol */}
        <div className="p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-1">Alcohol</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={alcoholVolume}
              onChange={(e) => setAlcoholVolume(e.target.value)}
              placeholder="ml"
              className="w-1/2 px-2 py-2 rounded bg-gray-700"
            />
            <input
              type="number"
              value={alcoholType}
              onChange={(e) => setAlcoholType(e.target.value)}
              placeholder="%"
              className="w-1/2 px-2 py-2 rounded bg-gray-700"
            />
          </div>
        </div>

        {/* Comment */}
        <div className="md:col-span-2 p-3 rounded bg-gray-900/30">
          <div className="text-sm text-gray-400 mb-1">Comment</div>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            placeholder="Poznámka k dňu (jet lag, svadba, preťaž.)"
            className="w-full px-2 py-2 rounded bg-gray-700 resize-y"
          />
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded text-white ${saving ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {saving ? "Ukladám…" : "Save"}
        </button>
      </div>
    </div>
  );
}