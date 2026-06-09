// src/features/coach/components/prefs/RecoveryInputs.tsx
"use client";

import { useMemo, useState, useEffect } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
import TimeSelectorField from "@/app/shared/ui/components/TimeSelectorField";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { addDaysIso } from "@/app/shared/utils/time";
import { toast } from "@/app/shared/ui/components/Toast";

import { apiSaveRecoveryPatch } from "@/app/features/recovery/api/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

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
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

// ============================================================
// FALLBACKY pre nových používateľov
// ============================================================
const FALLBACKS = {
  RHR_bpm: 50,
  HRV_avg_ms: 70,
  HRV_max_ms: 90,
  sleep_duration_min: 480,
  sleep_start_time: "22:00",
};

// ============================================================
// HELPERS
// ============================================================
function toNumberOrNull(val: number | string | null | undefined): number | null {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function sleepToMinutes(s: string): number | null {
  if (!s || s === "00:00") return null;
  const [h, m] = s.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(mins: number | string | null | undefined): string {
  if (typeof mins !== "number" || !Number.isFinite(mins)) return "";
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeTime(val: any): string {
  if (typeof val === "string" && val.includes(":")) {
    return val.slice(0, 5);
  }
  return FALLBACKS.sleep_start_time;
}

// ============================================================
// KOMPONENT
// ============================================================
export default function RecoveryInputs() {
  const { userId } = useUserId();
  const t = useT();
  const { settings } = useSettings() as any;
  const { rows, refresh } = useRecoveryData();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const showAdvanced = settings?.show_advanced ?? false;

  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(todayIso);

  // Biometrika
  const [rhr, setRhr] = useState<number | "">(FALLBACKS.RHR_bpm);
  const [hrvAvg, setHrvAvg] = useState<number | "">(FALLBACKS.HRV_avg_ms);
  const [hrvMax, setHrvMax] = useState<number | "">(FALLBACKS.HRV_max_ms);
  const [sleepDuration, setSleepDuration] = useState(minutesToHHMM(FALLBACKS.sleep_duration_min));
  const [sleepStart, setSleepStart] = useState(FALLBACKS.sleep_start_time);

  // Faktory
  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [alcoholVolume, setAlcoholVolume] = useState<number | "">("");
  const [alcoholType, setAlcoholType] = useState<number | "">("");
  const [comments, setComments] = useState("");

  // ============================================================
  // Načítanie dát pri zmene dátumu alebo rows
  // ============================================================
  useEffect(() => {
    if (!rows) return;

    const existing = rows.find((r: any) => r.date === date);

    if (existing) {
      // Existujúci záznam — načítaj všetky hodnoty
      setRhr(existing.RHR_bpm ?? FALLBACKS.RHR_bpm);
      setHrvAvg(existing.HRV_avg_ms ?? FALLBACKS.HRV_avg_ms);
      setHrvMax(existing.HRV_max_ms ?? FALLBACKS.HRV_max_ms);
      setSleepDuration(minutesToHHMM(existing.sleep_duration_min) || minutesToHHMM(FALLBACKS.sleep_duration_min));
      setSleepStart(normalizeTime(existing.sleep_start_time));
      setLateFood(Boolean(existing.food_2h_before));
      setLateCaffeine(Boolean(existing.caffeine_8h));
      setAlcoholVolume((existing as any).alcohol_volume_ml ?? "");
      setAlcoholType((existing as any).alcohol_type_pct ?? "");
      setComments(existing.comments ?? "");
    } else {
      // Nový deň — biometrika z posledného záznamu, faktory resetuj
      const last = [...rows]
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .find((r: any) => r.RHR_bpm || r.HRV_avg_ms);

      setRhr(last?.RHR_bpm ?? FALLBACKS.RHR_bpm);
      setHrvAvg(last?.HRV_avg_ms ?? FALLBACKS.HRV_avg_ms);
      setHrvMax(last?.HRV_max_ms ?? FALLBACKS.HRV_max_ms);
      setSleepDuration(minutesToHHMM(last?.sleep_duration_min) || minutesToHHMM(FALLBACKS.sleep_duration_min));
      setSleepStart(normalizeTime(last?.sleep_start_time));
      setLateFood(false);
      setLateCaffeine(false);
      setAlcoholVolume("");
      setAlcoholType("");
      setComments("");
    }
  }, [date, rows]);

  // ============================================================
  // SAVE — vždy uloží celý stav, žiadna dirty logika
  // ============================================================
  async function handleSave() {
    if (!userId) {
      toast.error(t("api.common.missingUserAuth"));
      return;
    }

    const patch = {
      date,
      user_id: userId,
      RHR_bpm: toNumberOrNull(rhr),
      HRV_avg_ms: toNumberOrNull(hrvAvg),
      HRV_max_ms: toNumberOrNull(hrvMax),
      sleep_duration_min: sleepToMinutes(sleepDuration),
      sleep_start_time: sleepStart && sleepStart !== "00:00" ? sleepStart : null,
      food_2h_before: Boolean(lateFood),
      caffeine_8h: Boolean(lateCaffeine),
      alcohol_volume_ml: toNumberOrNull(alcoholVolume),
      alcohol_type_pct: toNumberOrNull(alcoholType),
      comments: comments.trim() || null,
    };

    try {
      setSaving(true);
      await apiSaveRecoveryPatch(userId, patch);
      toast.success(t("recovery.inputs.saveSuccess"));
      setOpen(false);
      refresh(true);
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.recovery.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `${t("recovery.inputs.dateLabel")}: ${new Date(date).toLocaleDateString("sk-SK")}${
    userId ? "" : ` • ${t("recovery.inputs.notLoggedIn")}`
  }`;

  const tooltipContent =
    "RHR (pokojový tep) a HRV (variabilita tepu) sú hlavné zrkadlá regenerácie. Zapisovať by sa mali ideálne hneď ráno. Ak HRV klesne (alebo RHR stúpne) o viac ako 7–10 % oproti normálu, telo hlási preťaženie. Môže za to ťažký tréning, stres, blížiaca sa choroba, ale aj alkohol či ťažké jedlo neskoro večer. Tréner na základe týchto dát vie ochrániť zdravie a upraviť dnešný plán.";

  return (
    <InputsCard
      title={t("recovery.title")}
      subtitle={t("recovery.inputs.subtitle")}
      tooltip={tooltipContent}
      open={open}
      onOpenChange={setOpen}
      preview={previewText}
      always={
        <div className={INPUTS_CARD_DATE_ROW}>
          <div className={INPUTS_CARD_DATE_INNER}>
            <Button size="sm" variant="ghost" onClick={() => setDate((d) => addDaysIso(d, -1))} disabled={saving}>
              −1
            </Button>
            <DateField
              value={date}
              onChange={(v) => setDate(v ?? todayIso)}
              disabled={saving}
              className={INPUTS_CARD_DATE_PILL}
              variant="editable"
            />
            <Button size="sm" variant="ghost" onClick={() => setDate((d) => addDaysIso(d, +1))} disabled={saving}>
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

          {/* RHR */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("recovery.inputs.rhrLabel")}
            </div>
            <NumberWheelField
              min={30} max={150} step={1}
              value={rhr} disabled={saving}
              onChange={setRhr}
            />
          </section>

          {/* HRV avg */}
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
              {t("recovery.inputs.hrvAvgLabel")}
            </div>
            <NumberWheelField
              min={10} max={250} step={1}
              value={hrvAvg} disabled={saving}
              onChange={setHrvAvg}
            />
          </section>

          {/* Advanced sekcia */}
          {showAdvanced && (
            <div className="md:col-span-2 grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200 mt-2">

              {/* HRV max */}
              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  {t("recovery.inputs.hrvMaxLabel")}
                </div>
                <NumberWheelField
                  min={10} max={300} step={1}
                  value={hrvMax} disabled={saving}
                  onChange={setHrvMax}
                />
              </section>

              {/* Dĺžka spánku */}
              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  {t("recovery.inputs.sleepDurationLabel")}
                </div>
                <TimeSelectorField
                  hh={true} mm={true} ss={false}
                  value={sleepDuration || "00:00"}
                  disabled={saving}
                  onChange={setSleepDuration}
                />
              </section>

              {/* Čas zaspania */}
              <section className={SECTION} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                  {t("recovery.inputs.sleepStartLabel")}
                </div>
                <TimeSelectorField
                  hh={true} mm={true} ss={false}
                  value={sleepStart || "00:00"}
                  disabled={saving}
                  onChange={setSleepStart}
                />
              </section>

              {/* Faktory */}
              <section className={SECTION + " md:col-span-2 mt-2"} style={SECTION_STYLE}>
                <div className={INPUTS_CARD_LABEL_SM_2} style={{ color: appColors.textMuted }}>
                  {t("recovery.inputs.factorsSection")}
                </div>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <Checkbox
                    containerClassName={INPUTS_CARD_CHECK_ROW_MB}
                    checked={lateFood}
                    onChange={(e) => setLateFood(e.currentTarget.checked)}
                    disabled={saving}
                    label={t("recovery.inputs.lateFoodLabel")}
                  />
                  <Checkbox
                    containerClassName={INPUTS_CARD_CHECK_ROW_MB}
                    checked={lateCaffeine}
                    onChange={(e) => setLateCaffeine(e.currentTarget.checked)}
                    disabled={saving}
                    label={t("recovery.inputs.lateCaffeineLabel")}
                  />
                </div>

                {/* Alkohol */}
                <div className="mt-3">
                  <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                    {t("recovery.inputs.alcoholLabel")}
                  </div>
                  <div className={FORM_GRID_SPLIT}>
                    <NumberWheelField
                      min={0} max={2000} step={50}
                      value={alcoholVolume} disabled={saving}
                      onChange={setAlcoholVolume}
                    />
                    <NumberWheelField
                      min={0} max={80} step={1}
                      value={alcoholType} disabled={saving}
                      onChange={setAlcoholType}
                    />
                  </div>
                </div>

                {/* Poznámka */}
                <div className="mt-3">
                  <div className={INPUTS_CARD_LABEL_SM_1} style={{ color: appColors.textMuted }}>
                    {t("recovery.inputs.noteLabel")}
                  </div>
                  <TextField
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder={t("recovery.inputs.notePlaceholder")}
                    disabled={saving}
                  />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </InputsCard>
  );
}