"use client";

import { useState, useMemo } from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/shared/utils/recovery";
import { toast } from "@/shared/components/ui/Toast";

import {
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  WIDGET_HEADER_ROW,
  WIDGET_HEADER_SIDE,
  WIDGET_HEADER_CENTER,
  WIDGET_HEADER_BELOW,
  PILL_BUTTON,
  TEXTAREA_BASE,
} from "@/shared/ui/classes";

export default function InputsCard() {
  const { userId } = useUserId();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

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

  const shiftDate = (deltaDays: number) =>
    setDate((prev) => addDaysIso(prev, deltaDays));

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
      toast.success("✅ Recovery uložené");
    } catch (e: any) {
      toast.error("❌ Chyba: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <WidgetCard title="Recovery Inputs" accent="bg-slate-700" minH={0}>
      {/* HEADER – iba -1, dátum (1 pole), +1 */}
      <div className={WIDGET_HEADER_BELOW}>
        <div className={WIDGET_HEADER_ROW}>
          {/* ľavá strana – skok -1 */}
          <div className={WIDGET_HEADER_SIDE}>
            <div className="hidden sm:flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => shiftDate(-1)}
                disabled={saving}
              >
                −1
              </Button>
            </div>
          </div>

          {/* stred – JEDINÉ pole s dátumom (otvorí natívny picker) */}
          <div className={WIDGET_HEADER_CENTER}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              // použijeme vzhľad pilulky
              className={
                PILL_BUTTON +
                " text-center select-none " +
                " px-3 py-2 !rounded-xl " + // rozumné rozmery
                " w-[min(220px,70%)] " + // fit-to-size na mobile
                " [color-scheme:dark]" // krajší natívny picker v dark mode
              }
            />
          </div>

          {/* pravá strana – skok +1 a toggle formulára */}
          <div className={WIDGET_HEADER_SIDE + " flex justify-end gap-2"}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => shiftDate(+1)}
              disabled={saving}
            >
              +1
            </Button>
            <Button
              circle
              size="sm"
              variant="secondary"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Zbaliť formulár" : "Rozbaliť formulár"}
              title={open ? "Zbaliť" : "Rozbaliť"}
            >
              {open ? "−" : "+"}
            </Button>
          </div>
        </div>
      </div>

      {/* BODY – až po otvorení */}
      {open && (
        <>
          <div className={FORM_GRID_TWO}>
            {/* RHR */}
            <section className={SECTION}>
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
            <section className={SECTION}>
              <div className="text-sm opacity-75 mb-1">HRV (RMSSD)</div>
              <div className={FORM_GRID_SPLIT}>
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
            <section className={SECTION + " md:col-span-2"}>
              <div className="text-sm opacity-75 mb-1">Sleep</div>
              <div className={FORM_GRID_SPLIT}>
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
            <section className={SECTION}>
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
            <section className={SECTION}>
              <div className="text-sm opacity-75 mb-1">Alcohol</div>
              <div className={FORM_GRID_SPLIT}>
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

            {/* Comment */}
            <section className={SECTION + " md:col-span-2"}>
              <div className="text-sm opacity-75 mb-1">Comment</div>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Poznámka k dňu (jet lag, svadba, preťaž.)"
                disabled={saving}
                className={TEXTAREA_BASE}
              />
            </section>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-end mt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Ukladám…" : "Save"}
            </Button>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
