"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import DateField from "@/app/shared/ui/components/DateField";
import Checkbox from "@/app/shared/ui/components/Checkbox";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { addDaysIso, handleTimeInput } from "@/app/shared/utils/time";
import { toast } from "@/app/shared/ui/components/Toast";

import { apiSaveRecoveryPatch } from "@/app/features/recovery/api/recovery";
// ✅ IMPORT HOOKU PRE REFRESH DÁT
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
  
  // ✅ VYTIAHNUTIE FUNKCIE REFRESH Z PROVIDERA
  const { refresh } = useRecoveryData();

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
      
      // ✅ ZATVORENIE, VYČISTENIE A REFRESH CELÉHO PROVIDERA
      setOpen(false);
      setDirty({});
      refresh(true); 
      
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.recovery.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const previewText = `${t("recovery.inputs.dateLabel")}: ${date}${userId ? "" : ` • ${t("recovery.inputs.notLoggedIn")}`}`;

  // ... (ZBYTOK KÓDU ZOSTÁVA ÚPLNE IDENTICKÝ, RETURN BLOK NEMENÍŠ) ...
  return (
    <InputsCard
      title={t("recovery.title")}
      subtitle={t("recovery.inputs.subtitle")}
// ...
