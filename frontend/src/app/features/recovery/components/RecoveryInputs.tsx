// src/features/coach/components/prefs/RecoveryInputs.tsx
"use client";

import { useMemo, useState, useEffect } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import NumberField from "@/app/shared/ui/components/NumberField";
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
    "RHR (pokojový tep) a HRV (variabilita tepu) sú hlavné zrkadlá regenerácie. Zapisovať by sa mali ideálne hneď ráno. Ak HRV klesne (alebo RHR stúpne) o viac
