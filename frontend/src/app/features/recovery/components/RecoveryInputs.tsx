"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import Checkbox from "@/app/shared/ui/components/Checkbox1";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/app/shared/utils/time";
import { toast } from "@/app/shared/ui/components/Toast";

import { apiSaveRecoveryPatch } from "@/app/features/recovery/api/recovery";

import {
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PANEL_STACK,
  SECTION_STYLE,
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
import { useT } from "@/app/shared/i18n/useT";

type DirtyKey =
  | "RHR_bpm"
  | "HRV_avg_ms"
  | "HRV_max_ms"
  | "sleep_start_time"
  | "sleep_duration_min"
  | "food_2h_before"
  | "caffeine_8h"
  | "alcohol_volume_ml"
  | "alcohol_type_pct"
  | "comments";

type DirtyMap = Partial<Record<DirtyKey, boolean>>;

function toNumberOrNull(s: string): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function sleepHHMMToMinutesOrNull(s: string): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export default function RecoveryInputs() {
  const { userId } = useUserId();
  const t = useT();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState<string>(todayIso);

  // main indicators
  const [rhr, setRhr] = useState("");
  const [hrvAvg, setHrvAvg] = useState("");
  const [sleepDuration, setSleepDuration] = useState("");

  // “influence” factors
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [alcoholVolume, setAlcoholVolume] = useState("");
  const [alcoholType, setAlcoholType] = useState("");
  const [comments, setComments] = useState("");

  // add-ons
  const [hrvMax, setHrvMax] = useState("");
  const [sleepStart, setSleepStart] = useState("");

  const [dirty, setDirty] = useState<DirtyMap>({});

  const markDirty = (k: DirtyKey) => {
    setDirty((d) => (d[k] ? d : { ...d, [k]: true }));
  };

  const shiftDate = (deltaDays: number) =>
    setDate((prev) => addDaysIso(prev, deltaDays));

  async function handleSave() {
    if (!userId) {
      toast.error(t("api.common.missingUserAuth"));
      return;
    }

    const patch: any = { date, user_id: userId };

    if (dirty.RHR_bpm) patch.RHR_bpm = toNumberOrNull(rhr);
    if (dirty.HRV_avg_ms) patch.HRV_avg_ms = toNumberOrNull(hrvAvg);
    if (dirty.sleep_duration_min)
      patch.sleep_duration_min = sleepHHMMToMinutesOrNull(sleepDuration);

    if (dirty.food_2h_before) patch.food_2h_before = Boolean(lateFood);
    if (dirty.caffeine_8h) patch.caffeine_8h = Boolean(lateCaffeine);
    if (dirty.alcohol_volume_ml)
      patch.alcohol_volume_ml = toNumberOrNull(alcoholVolume);
    if (dirty.alcohol_type_pct)
      patch.alcohol_type_pct = toNumberOrNull(alcoholType);
    if (dirty.comments)
      patch.comments = comments.trim() ? comments.trim() : null;

    if (dirty.HRV_max_ms) patch.HRV_max_ms = toNumberOrNull(hrvMax);
    if (dirty.sleep_start_time)
      patch.sleep_start_time = sleepStart ? sleepStart : null;

    const keys = Object.keys(patch).filter(
      (k) => k !== "date" && k !== "user_id",
    );
    if (keys.length === 0) {
      toast.error(t("recovery.inputs.errorNoChanges"));
      return;
    }

    try {
      setSaving(true);
      await apiSaveRecoveryPatch(userId, patch);
      toast.success(t("recovery.inputs.saveSuccess"));
      setOpen(false);
      setDirty({});
    } catch (e: any) {
      // ✅ ZMENA: Preložíme api error message
      toast.error(t(e?.message as any) || t("api.recovery.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `${t("recovery.inputs.dateLabel")}: ${date}${userId ? "" : ` • ${t("recovery.inputs.notLoggedIn")}`}`;

  return (
    <InputsCard
      title={t("recovery.title")}
      subtitle={t("recovery.inputs.subtitle")}
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
          variant="primary"
          onClick={handleSave}
          disabled={saving || !userId}
          className={INPUTS_CARD_SAVE_BTN}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          {/* HLAVNÉ UKAZOVATELE */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.hrvAvgLabel")}
            </div>
            <TextField
              type="number"
              value={hrvAvg}
              onChange={(e) => {
                setHrvAvg(e.target.value);
                markDirty("HRV_avg_ms");
              }}
              placeholder="ms"
              disabled={saving}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.rhrLabel")}
            </div>
            <TextField
              type="number"
              value={rhr}
              onChange={(e) => {
                setRhr(e.target.value);
                markDirty("RHR_bpm");
              }}
              placeholder="bpm"
              disabled={saving}
            />
          </section>

          <section className={SECTION + " md:col-span-2"} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.sleepDurationLabel")}
            </div>
            <TextField
              type="text"
              placeholder="HH:MM"
              value={sleepDuration}
              onChange={(e) => {
                handleTimeInput(e, setSleepDuration);
                markDirty("sleep_duration_min");
              }}
              inputMode="numeric"
              disabled={saving}
            />
          </section>

          {/* OVPLYVŇUJÚCE FAKTORY */}
          <section className={SECTION + " md:col-span-2"} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_2}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.factorsSection")}
            </div>

            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <Checkbox
                containerClassName={INPUTS_CARD_CHECK_ROW_MB}
                checked={lateFood}
                onChange={(e) => {
                  setLateFood(e.currentTarget.checked);
                  markDirty("food_2h_before");
                }}
                disabled={saving}
                label={t("recovery.inputs.lateFoodLabel")}
              />

              <Checkbox
                containerClassName={INPUTS_CARD_CHECK_ROW_MB}
                checked={lateCaffeine}
                onChange={(e) => {
                  setLateCaffeine(e.currentTarget.checked);
                  markDirty("caffeine_8h");
                }}
                disabled={saving}
                label={t("recovery.inputs.lateCaffeineLabel")}
              />
            </div>

            <div className="mt-3">
              <div
                className={INPUTS_CARD_LABEL_SM_1}
                style={{ color: appColors.textMuted }}
              >
                {t("recovery.inputs.alcoholLabel")}
              </div>
              <div className={FORM_GRID_SPLIT}>
                <TextField
                  type="number"
                  value={alcoholVolume}
                  onChange={(e) => {
                    setAlcoholVolume(e.target.value);
                    markDirty("alcohol_volume_ml");
                  }}
                  placeholder="ml"
                  disabled={saving}
                />
                <TextField
                  type="number"
                  value={alcoholType}
                  onChange={(e) => {
                    setAlcoholType(e.target.value);
                    markDirty("alcohol_type_pct");
                  }}
                  placeholder="%"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="mt-3">
              <div
                className={INPUTS_CARD_LABEL_SM_1}
                style={{ color: appColors.textMuted }}
              >
                {t("recovery.inputs.noteLabel")}
              </div>
              <TextField
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  markDirty("comments");
                }}
                placeholder={t("recovery.inputs.notePlaceholder")}
                disabled={saving}
              />
            </div>
          </section>

          {/* DOPLNKY */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.hrvMaxLabel")}
            </div>
            <TextField
              type="number"
              value={hrvMax}
              onChange={(e) => {
                setHrvMax(e.target.value);
                markDirty("HRV_max_ms");
              }}
              placeholder="ms"
              disabled={saving}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.sleepStartLabel")}
            </div>
            <TextField
              type="text"
              placeholder="HH:MM"
              value={sleepStart}
              onChange={(e) => {
                handleTimeInput(e, setSleepStart);
                markDirty("sleep_start_time");
              }}
              inputMode="numeric"
              disabled={saving}
            />
          </section>
        </div>
      </div>
    </InputsCard>
  );
}
