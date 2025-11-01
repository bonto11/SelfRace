// src/features/recovery/components/InputsCard.tsx
"use client";

import { useState, useMemo } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/shared/utils/recovery";

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
    <WidgetCard title="Recovery Inputs" accent="bg-slate-700" minH={0}>
      {/* HEADER actions */}
      <div className="mb-3">
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftDate(-1)}
            disabled={saving}
            className="shrink-0"
            aria-label="Predošlý deň"
          >
            −1d
          </Button>
      
          <TextField
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={saving}
            className="
              w-[150px] text-center shrink-0
              focus:ring-2 focus:ring-white/25 focus:ring-offset-2
              focus:ring-offset-[--widget-bg,_#0b0f1a]   /* fallback ak nemáš CSS var */
            "
          />
      
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftDate(+1)}
            disabled={saving}
            className="shrink-0"
            aria-label="Ďalší deň"
          >
            +1d
          </Button>
        </div>
      </div>

      {/* BODY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* RHR */}
        <section className="rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-1">Resting HR</div>
          <TextField
            type="number"
            value={rhr}
            onChange={(e) => setRhr(e.target.value)}
            placeholder="bpm"
            disabled={saving}
          />
        </section>

        {/* HRV avg / max */}
        <section className="rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-1">HRV (RMSSD)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField
              type="number"
              value={hrvAvg}
              onChange={(e) => setHrvAvg(e.target.value)}
              placeholder="avg ms"
              disabled={saving}
            />
            <TextField
              type="number"
              value={hrvMax}
              onChange={(e) => setHrvMax(e.target.value)}
              placeholder="max ms"
              disabled={saving}
            />
          </div>
        </section>

        {/* Sleep */}
        <section className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-1">Sleep</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField
              type="text"
              placeholder="HH:MM duration"
              value={sleepDuration}
              onChange={(e) => handleTimeInput(e, setSleepDuration)}
              inputMode="numeric"
              disabled={saving}
            />
            <TextField
              type="text"
              placeholder="HH:MM start"
              value={sleepStart}
              onChange={(e) => handleTimeInput(e, setSleepStart)}
              inputMode="numeric"
              disabled={saving}
            />
          </div>
        </section>

        {/* Evening factors */}
        <section className="rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-2">Evening factors</div>

          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={lateFood}
              onChange={(e) => setLateFood(e.target.checked)}
              disabled={saving}
            />
            <span>Food ≤ 2h before bed</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={lateCaffeine}
              onChange={(e) => setLateCaffeine(e.target.checked)}
              disabled={saving}
            />
            <span>Caffeine ≤ 8h before bed</span>
          </label>
        </section>

        {/* Alcohol */}
        <section className="rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-1">Alcohol</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField
              type="number"
              value={alcoholVolume}
              onChange={(e) => setAlcoholVolume(e.target.value)}
              placeholder="ml"
              disabled={saving}
            />
            <TextField
              type="number"
              value={alcoholType}
              onChange={(e) => setAlcoholType(e.target.value)}
              placeholder="%"
              disabled={saving}
            />
          </div>
        </section>

        {/* Comment – POZOR: natívny <textarea>, nie TextField */}
        <section className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 dark:bg-gray-900/40 p-3">
          <div className="text-sm opacity-75 mb-1">Comment</div>
          <textarea
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Poznámka k dňu (jet lag, svadba, preťaž.)"
            disabled={saving}
            className="w-full rounded-md bg-white/70 dark:bg-gray-800/60 border border-white/10 px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-white/20 resize-y"
          />
        </section>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-end mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Ukladám…" : "Save"}
        </Button>
      </div>
    </WidgetCard>
  );
}