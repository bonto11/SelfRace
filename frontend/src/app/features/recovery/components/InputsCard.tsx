// src/features/recovery/components/InputsCard.tsx
"use client";

import { useMemo, useState } from "react";

import Button from "@/app/shared/components/ui/Button";
import TextField from "@/app/shared/components/ui/TextField";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/app/shared/utils/time";
import { toast } from "@/app/shared/components/ui/Toast";

import { apiSaveRecovery } from "@/app/features/recovery/api/recovery";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  // layout
  CARD,
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_STACK,
  PANEL_ACTIONS_INLINE,
  PANEL_PREVIEW,

  // styles
  SURFACE_CARD_STYLE,
  SECTION_STYLE,

  // misc
  PILL_BUTTON,
  TEXTAREA_BASE,
} from "@/app/shared/ui/tokens";

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
    if (!userId) {
      toast.error("Chýba používateľ.");
      return;
    }

    let sleepMinutes: number | null = null;
    if (sleepDuration) {
      const [h, m] = sleepDuration.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) sleepMinutes = h * 60 + m;
    }

    const payload = {
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
      comments: comments || null,
    };

    try {
      setSaving(true);
      await apiSaveRecovery(userId, payload as any);
      toast.success("Recovery uložené.");
    } catch (e: any) {
      toast.error("Chyba: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `Dátum: ${date}${userId ? "" : " • neprihlásený"}`;

  return (
    <section className={CARD} style={SURFACE_CARD_STYLE}>
      {/* HEAD */}
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            Recovery
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            RHR, HRV, spánok a faktory večera.
          </div>
        </div>

        <div className={PANEL_ACTIONS_INLINE}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
            disabled={saving}
            aria-label={open ? "Zbaliť" : "Rozbaliť"}
          >
            {open ? "Zbaliť" : "Rozbaliť"}
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={saving || !userId}
          >
            {saving ? "Ukladám…" : "Uložiť"}
          </Button>
        </div>
      </div>

      <div className={CARD_BODY_INSET}>
        {/* DATE ROW (always visible) */}
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => shiftDate(-1)}
              disabled={saving}
            >
              −1
            </Button>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
              className={[
                PILL_BUTTON,
                "text-center px-3 py-2 !rounded-xl w-[min(220px,60vw)] [color-scheme:dark]",
              ].join(" ")}
            />

            <Button
              size="sm"
              variant="ghost"
              onClick={() => shiftDate(+1)}
              disabled={saving}
            >
              +1
            </Button>
          </div>
        </div>

        {/* COLLAPSED PREVIEW */}
        {!open && (
          <div
            className={["mt-3", PANEL_PREVIEW].join(" ")}
            style={{ color: appColors.textMuted }}
          >
            {previewText}
          </div>
        )}

        {/* BODY */}
        {open && (
          <div className={["mt-4", PANEL_STACK].join(" ")}>
            <div className={FORM_GRID_TWO}>
              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className="text-sm mb-1"
                  style={{ color: appColors.textMuted }}
                >
                  Resting HR
                </div>
                <TextField
                  type="number"
                  value={rhr}
                  onChange={(e) => setRhr(e.target.value)}
                  placeholder="bpm"
                  disabled={saving}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className="text-sm mb-1"
                  style={{ color: appColors.textMuted }}
                >
                  HRV (RMSSD)
                </div>
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

              <section
                className={SECTION + " md:col-span-2"}
                style={SECTION_STYLE}
              >
                <div
                  className="text-sm mb-1"
                  style={{ color: appColors.textMuted }}
                >
                  Sleep
                </div>
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

              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className="text-sm mb-2"
                  style={{ color: appColors.textMuted }}
                >
                  Evening factors
                </div>

                <label className="flex items-center gap-2 mb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lateFood}
                    onChange={(e) => setLateFood(e.target.checked)}
                    disabled={saving}
                  />
                  <span>Food ≤ 2h before bed</span>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lateCaffeine}
                    onChange={(e) => setLateCaffeine(e.target.checked)}
                    disabled={saving}
                  />
                  <span>Caffeine ≤ 8h before bed</span>
                </label>
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className="text-sm mb-1"
                  style={{ color: appColors.textMuted }}
                >
                  Alcohol
                </div>
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

              <section
                className={SECTION + " md:col-span-2"}
                style={SECTION_STYLE}
              >
                <div
                  className="text-sm mb-1"
                  style={{ color: appColors.textMuted }}
                >
                  Comment
                </div>
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
          </div>
        )}
      </div>
    </section>
  );
}
