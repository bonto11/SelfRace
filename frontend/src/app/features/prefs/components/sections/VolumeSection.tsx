// src/features/coach/components/prefs/VolumeSection.tsx
"use client";

import { useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

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
  const [open, setOpen] = useState(false);

  const mode: VolumeInputMode =
    (volume?.mode as VolumeInputMode | undefined) ?? "weekly_hours";

  const rawValue = volume?.value != null ? Number(volume.value) : NaN;
  const safeVal = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : NaN;

  const { weeklyHours, dailyMinutes } = useMemo(() => {
    if (!Number.isFinite(safeVal) || safeVal <= 0) {
      return {
        weeklyHours: null as number | null,
        dailyMinutes: null as number | null,
      };
    }

    if (mode === "weekly_hours") {
      const wh = safeVal;
      const dm = (wh * 60) / 7;
      return { weeklyHours: wh, dailyMinutes: dm };
    }

    const dm = safeVal;
    const wh = (dm * 7) / 60;
    return { weeklyHours: wh, dailyMinutes: dm };
  }, [safeVal, mode]);

  const previewText = useMemo(() => {
    if (!weeklyHours || !dailyMinutes) {
      return "No volume limit set – coach odhaduje objem podľa cieľov a histórie.";
    }
    const wh = weeklyHours.toFixed(1);
    const dm = Math.round(dailyMinutes);
    return `≈ ${wh} h / týždeň · ≈ ${dm} min / deň. Coach sa väčšinou snaží zostať pod týmto objemom (okrem krátkeho peaku pred hlavnými pretekmi).`;
  }, [weeklyHours, dailyMinutes]);

  const handleModeChange = (nextMode: VolumeInputMode) => {
    const next: VolumePrefs = {
      mode: nextMode,
      value: volume?.value ?? null,
    };
    setPref("volume", next);
  };

  const handleValueChange = (v: string) => {
    const raw = (v ?? "").trim();
    if (!raw) {
      setPref("volume", { mode, value: null } as VolumePrefs);
      return;
    }

    const num = Number(raw.replace(",", "."));
    if (Number.isNaN(num) || num < 0) return;

    setPref("volume", { mode, value: num } as VolumePrefs);
  };

  const valueLabel =
    mode === "weekly_hours" ? "Value [h / týždeň]" : "Value [min / deň]";

  const previewNode = <span>{previewText}</span>;

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Training volume</span>
          <InfoPopover text="Nastav orientačný týždenný objem tréningu. Zadaj buď celkové hodiny za týždeň, alebo priemerné minúty za deň. Coach sa bude snažiť držať väčšinu týždňov pod týmto limitom." />
        </div>
      }
      subtitle="Limit objemu pre plánovanie (hodiny/týždeň alebo minúty/deň)."
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Input mode</div>
            <SelectField
              value={mode}
              onChange={(e) =>
                handleModeChange(e.target.value as VolumeInputMode)
              }
              options={[
                { value: "weekly_hours", label: "Total weekly [h]" },
                { value: "daily_minutes", label: "Average daily [min]" },
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

        {/* repeated help text when open */}
        <div className="text-xs opacity-80 leading-relaxed">{previewText}</div>
      </div>
    </InputsCard>
  );
}
