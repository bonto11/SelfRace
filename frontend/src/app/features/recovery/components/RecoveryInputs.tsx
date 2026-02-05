"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import Checkbox from "@/app/shared/ui/components/CheckBox";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/app/shared/utils/time";
import { toast } from "@/app/shared/ui/components/Toast";

import { apiSaveRecovery } from "@/app/features/recovery/api/recovery";

import {
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_STACK,
  SECTION_STYLE,

  // inputsCard tokens
  INPUTS_CARD_DATE_ROW,
  INPUTS_CARD_DATE_INNER,
  INPUTS_CARD_DATE_PILL,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  INPUTS_CARD_LABEL_SM_2,
  INPUTS_CARD_CHECK_ROW_MB,
  INPUTS_CARD_SAVE_BTN,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function RecoveryInputs() {
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
      toast.success("Regenerácia uložená.");
      setOpen(false);
    } catch (e: any) {
      toast.error("Chyba: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `Dátum: ${date}${userId ? "" : " • neprihlásený"}`;

  return (
    <InputsCard
      title="Regenerácia"
      subtitle="Tu môžeš zadať údaje o tvojej regenerácii (RHR, HRV, spánok a večerné faktory)."
      open={open}
      onOpenChange={setOpen}
      preview={previewText}
      always={
        <div className={INPUTS_CARD_DATE_ROW}>
          <div className={INPUTS_CARD_DATE_INNER}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => shiftDate(-1)}
              disabled={saving}
            >
              −1
            </Button>

            {/* ✅ clickable full pill + centered text */}
            <DateField
              value={date}
              onChange={(v) => setDate(v ?? todayIso)}
              disabled={saving}
              className={INPUTS_CARD_DATE_PILL}
              variant="editable"
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
      }
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={saving || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {saving ? "Ukladám…" : "Uložiť"}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              RHR
            </div>
            <TextField
              type="number"
              value={rhr}
              onChange={(e) => setRhr(e.target.value)}
              placeholder="údery/min"
              disabled={saving}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              HRV (RMSSD)
            </div>
            <div className={FORM_GRID_SPLIT}>
              <TextField
                type="number"
                value={hrvAvg}
                onChange={(e) => setHrvAvg(e.target.value)}
                placeholder="priemer (ms)"
                disabled={saving}
              />
              <TextField
                type="number"
                value={hrvMax}
                onChange={(e) => setHrvMax(e.target.value)}
                placeholder="maximum (ms)"
                disabled={saving}
              />
            </div>
          </section>

          <section className={SECTION + " md:col-span-2"} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Spánok
            </div>
            <div className={FORM_GRID_SPLIT}>
              <TextField
                type="text"
                placeholder="HH:MM trvanie"
                value={sleepDuration}
                onChange={(e) => handleTimeInput(e, setSleepDuration)}
                inputMode="numeric"
                disabled={saving}
              />
              <TextField
                type="text"
                placeholder="HH:MM začiatok"
                value={sleepStart}
                onChange={(e) => handleTimeInput(e, setSleepStart)}
                inputMode="numeric"
                disabled={saving}
              />
            </div>
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_2}
              style={{ color: appColors.textMuted }}
            >
              Večerné faktory
            </div>

            <Checkbox
              containerClassName={INPUTS_CARD_CHECK_ROW_MB}
              checked={lateFood}
              onChange={(e) => setLateFood(e.currentTarget.checked)}
              disabled={saving}
              label="Jedlo ≤ 2 h pred spaním"
            />

            <Checkbox
              containerClassName={INPUTS_CARD_CHECK_ROW_MB}
              checked={lateCaffeine}
              onChange={(e) => setLateCaffeine(e.currentTarget.checked)}
              disabled={saving}
              label="Kofeín ≤ 8 h pred spaním"
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              Alkohol
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

          <section className={SECTION + " md:col-span-2"} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              Poznámka
            </div>

            <TextField
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Poznámka k dňu (jet lag, svadba, preťaženie...)"
              disabled={saving}
            />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}
