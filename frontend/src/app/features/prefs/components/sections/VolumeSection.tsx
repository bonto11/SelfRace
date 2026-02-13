// src/features/coach/components/prefs/VolumeSection.tsx
"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import { useT } from "@/app/shared/i18n/useT";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import type { VolumePrefs } from "@/app/features/prefs/types/prefs";

import {
  SECTION,
  SECTION_STYLE,
  FORM_GRID_TWO,
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
} from "@/app/shared/ui/tokens";

type VolumeInputMode = "weekly_hours" | "daily_minutes";

type Props = {
  volume: VolumePrefs | null | undefined;
  setPref: (key: any, value: any) => void;
};

export function VolumeSection({ volume, setPref }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const mode: VolumeInputMode = (volume?.mode as VolumeInputMode | undefined) ?? "weekly_hours";

  const rawValue = volume?.value != null ? Number(volume.value) : NaN;
  const safeVal = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : NaN;

  const { weeklyHours, dailyMinutes } = useMemo(() => {
    if (!Number.isFinite(safeVal) || safeVal <= 0) {
      return { weeklyHours: null, dailyMinutes: null };
    }
    if (mode === "weekly_hours") {
      return { weeklyHours: safeVal, dailyMinutes: (safeVal * 60) / 7 };
    }
    return { weeklyHours: (safeVal * 7) / 60, dailyMinutes: safeVal };
  }, [safeVal, mode]);

  const previewText = useMemo(() => {
    if (!weeklyHours || !dailyMinutes) {
      return t("prefs.sections.volumeSection.previewEmpty");
    }
    const wh = weeklyHours.toFixed(1);
    const dm = Math.round(dailyMinutes);
    return t("prefs.sections.volumeSection.previewText")
      .replace("{{hours}}", wh)
      .replace("{{minutes}}", String(dm));
  }, [weeklyHours, dailyMinutes, t]);

  const handleModeChange = (nextMode: VolumeInputMode) => {
    setPref("volume", { mode: nextMode, value: volume?.value ?? null });
  };

  const handleValueChange = (v: string) => {
    const raw = (v ?? "").trim();
    if (!raw) {
      setPref("volume", { mode, value: null });
      return;
    }
    const num = Number(raw.replace(",", "."));
    if (Number.isNaN(num) || num < 0) return;
    setPref("volume", { mode, value: num });
  };

  const valueLabel = mode === "weekly_hours" 
    ? t("prefs.sections.volumeSection.valueWeekly") 
    : t("prefs.sections.volumeSection.valueDaily");

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.volumeSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.volumeSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.volumeSection.subtitle")}
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.volumeSection.modeLabel")}</div>
            <SelectField
              value={mode}
              onChange={(e) => handleModeChange(e.target.value as VolumeInputMode)}
              options={[
                { value: "weekly_hours", label: t("prefs.sections.volumeSection.enums.weekly") },
                { value: "daily_minutes", label: t("prefs.sections.volumeSection.enums.daily") },
              ]}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{valueLabel}</div>
            <TextField
              type="number"
              min={0}
              step={mode === "weekly_hours" ? 0.5 : 5}
              value={Number.isFinite(safeVal) ? String(safeVal) : ""}
              onChange={(e) => handleValueChange(e.currentTarget.value)}
            />
          </section>
        </div>

        <div className="flex items-start gap-2 text-xs opacity-80 leading-relaxed italic">
          <div className="flex-1">{previewText}</div>
          <TooltipIcon text={t("prefs.sections.volumeSection.hintTooltip")} />
        </div>
      </div>
    </InputsCard>
  );
}