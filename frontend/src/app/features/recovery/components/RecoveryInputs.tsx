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

function toNumberOrNull(val: number | string | null | undefined): number | null {
  if (val === "" || val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function sleepHHMMToMinutesOrNull(s: string): number | null {
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

export default function RecoveryInputs() {
  const { userId } = useUserId();
  const t = useT();
  
  const { settings } = useSettings() as any; 
  
  // 👈 OPRAVA TU: Vytiahneme 'rows', nie 'data'
  const { rows, refresh } = useRecoveryData();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const showAdvanced = settings?.show_advanced ?? false;

  const [date, setDate] = useState<string>(todayIso);

  const [rhr, setRhr] = useState<number | "">("");
  const [hrvAvg, setHrvAvg] = useState<number | "">("");
  const [sleepDuration, setSleepDuration] = useState("");

  const [lateFood, setLateFood] = useState(false);
  const [lateCaffeine, setLateCaffeine] = useState(false);
  const [alcoholVolume, setAlcoholVolume] = useState<number | "">("");
  const [alcoholType, setAlcoholType] = useState<number | "">("");
  const [comments, setComments] = useState("");

  const [hrvMax, setHrvMax] = useState<number | "">("");
  const [sleepStart, setSleepStart] = useState("");

  const [dirty, setDirty] = useState<DirtyMap>({});
  
  const [isInitialized, setIsInitialized] = useState(false);

  const markDirty = (k: DirtyKey) => {
    setDirty((d) => (d[k] ? d : { ...d, [k]: true }));
  };

  const shiftDate = (deltaDays: number) =>
    setDate((prev) => addDaysIso(prev, deltaDays));

  // SMART INIT - Nájdenie najnovších známych hodnôt z histórie
  useEffect(() => {
    if (isInitialized) return; 

    // Ak máme načítané rows, môžeme predvyplniť
    if (rows && rows.length > 0) {
      console.log("=== RECOVERY INPUTS INIT ===");
      
      // Zotriedime dáta od najnovších po najstaršie
      const sortedData = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Helper na nájdenie prvej nenulovej hodnoty
      const findLatest = (key: string) => {
        const entry = sortedData.find((d) => 
          (d as any)[key] !== null && 
          (d as any)[key] !== undefined && 
          (d as any)[key] !== "" && 
          (d as any)[key] !== 0
        );
        const val = entry ? (entry as any)[key] : "";
        console.log(`Hodnota pre [${key}]:`, val, entry ? `(z dátumu ${entry.date})` : "(nenašlo sa)");
        return val;
      };

      const latestRhr = findLatest("RHR_bpm");
      const latestHrvAvg = findLatest("HRV_avg_ms");
      const latestHrvMax = findLatest("HRV_max_ms");
      const latestSleepDur = findLatest("sleep_duration_min");
      const latestSleepStart = findLatest("sleep_start_time");

      setRhr(latestRhr as number | "");
      setHrvAvg(latestHrvAvg as number | "");
      setHrvMax(latestHrvMax as number | "");

      if (typeof latestSleepDur === "number") {
        setSleepDuration(minutesToHHMM(latestSleepDur));
      }

      if (typeof latestSleepStart === "string" && latestSleepStart.includes(":")) {
        setSleepStart(`${latestSleepStart.split(":")[0]}:${latestSleepStart.split(":")[1]}`);
      }

      setLateFood(false);
      setLateCaffeine(false);
      setAlcoholVolume("");
      setAlcoholType("");
      setComments("");

      setIsInitialized(true);
      console.log("=== INIT DOKONČENÝ ===");
    }
  }, [rows, isInitialized]);

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
      patch.sleep_start_time = sleepStart && sleepStart !== "00:00" ? sleepStart : null;

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
      refresh(true); 
      
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.recovery.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `${t("recovery.inputs.dateLabel")}: ${new Date(date).toLocaleDateString("sk-SK")}${userId ? "" : ` • ${t("recovery.inputs.notLoggedIn")}`}`;

  const tooltipContent = "RHR (pokojový tep) a HRV (variabilita tepu) sú hlavné zrkadlá regenerácie. Zapisovať by sa mali ideálne hneď ráno. Ak HRV klesne (alebo RHR stúpne) o viac ako 7–10 % oproti normálu, telo hlási preťaženie. Môže za to ťažký tréning, stres, blížiaca sa choroba, ale aj alkohol či ťažké jedlo neskoro večer. Tréner na základe týchto dát vie ochrániť zdravie a upraviť dnešný plán.";

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

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.rhrLabel")}
            </div>
            <NumberWheelField
              min={30}
              max={150}
              step={1}
              value={rhr}
              disabled={saving}
              onChange={(val) => {
                setRhr(val);
                markDirty("RHR_bpm");
              }}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div
              className={INPUTS_CARD_LABEL_SM_1}
              style={{ color: appColors.textMuted }}
            >
              {t("recovery.inputs.hrvAvgLabel")}
            </div>
            <NumberWheelField
              min={10}
              max={250}
              step={1}
              value={hrvAvg}
              disabled={saving}
              onChange={(val) => {
                setHrvAvg(val);
                markDirty("HRV_avg_ms");
              }}
            />
          </section>

          {showAdvanced && (
            <div className="md:col-span-2 grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-1 duration-200 mt-2">
              
              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className={INPUTS_CARD_LABEL_SM_1}
                  style={{ color: appColors.textMuted }}
                >
                  {t("recovery.inputs.hrvMaxLabel")}
                </div>
                <NumberWheelField
                  min={10}
                  max={300}
                  step={1}
                  value={hrvMax}
                  disabled={saving}
                  onChange={(val) => {
                    setHrvMax(val);
                    markDirty("HRV_max_ms");
                  }}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className={INPUTS_CARD_LABEL_SM_1}
                  style={{ color: appColors.textMuted }}
                >
                  {t("recovery.inputs.sleepDurationLabel")}
                </div>
                <TimeSelectorField
                  hh={true}
                  mm={true}
                  ss={false}
                  value={sleepDuration || "00:00"}
                  disabled={saving}
                  onChange={(val) => {
                    setSleepDuration(val);
                    markDirty("sleep_duration_min");
                  }}
                />
              </section>

              <section className={SECTION} style={SECTION_STYLE}>
                <div
                  className={INPUTS_CARD_LABEL_SM_1}
                  style={{ color: appColors.textMuted }}
                >
                  {t("recovery.inputs.sleepStartLabel")}
                </div>
                <TimeSelectorField
                  hh={true}
                  mm={true}
                  ss={false}
                  value={sleepStart || "00:00"}
                  disabled={saving}
                  onChange={(val) => {
                    setSleepStart(val);
                    markDirty("sleep_start_time");
                  }}
                />
              </section>

              <section className={SECTION + " md:col-span-2 mt-2"} style={SECTION_STYLE}>
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
                    <NumberWheelField
                      min={0}
                      max={2000}
                      step={50}
                      value={alcoholVolume}
                      disabled={saving}
                      onChange={(val) => {
                        setAlcoholVolume(val);
                        markDirty("alcohol_volume_ml");
                      }}
                    />
                    <NumberWheelField
                      min={0}
                      max={80}
                      step={1}
                      value={alcoholType}
                      disabled={saving}
                      onChange={(val) => {
                        setAlcoholType(val);
                        markDirty("alcohol_type_pct");
                      }}
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
            </div>
          )}

        </div>
      </div>
    </InputsCard>
  );
}