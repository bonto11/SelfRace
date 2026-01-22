// src/features/coach/components/prefs/VolumeSection.tsx
"use client";

import { useState, useMemo } from "react";
import TextField from "@/app/shared/components/ui/TextField";
import SelectField from "@/app/shared/components/ui/SelectField";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import { SECTION, SURFACE_INLINE } from "@/app/shared/theme/uiTokens";
import type { VolumePrefs } from "@/app/features/prefs/types/prefs";

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

  const safeVal =
    Number.isFinite(rawValue) && rawValue > 0 ? (rawValue as number) : NaN;

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
    } else {
      const dm = safeVal;
      const wh = (dm * 7) / 60;
      return { weeklyHours: wh, dailyMinutes: dm };
    }
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
    if (!v) {
      const next: VolumePrefs = {
        mode,
        value: null,
      };
      setPref("volume", next);
      return;
    }
    const num = Number(v.replace(",", "."));
    if (Number.isNaN(num) || num < 0) return;

    const next: VolumePrefs = {
      mode,
      value: num,
    };
    setPref("volume", next);
  };

  const valueLabel =
    mode === "weekly_hours" ? "Value [h / týždeň]" : "Value [min / deň]";

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Training volume</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Nastav orientačný týždenný objem tréningu. Zadaj buď celkové hodiny za týždeň, alebo priemerné minúty za deň. Coach sa bude snažiť držať väčšinu týždňov pod týmto limitom." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse volume"
            labelWhenClosed="Expand volume"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs select-none opacity-80",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {/* Body */}
      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-80 mb-1">Input mode</div>
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
            </div>

            <div>
              <div className="text-xs opacity-80 mb-1">{valueLabel}</div>
              <TextField
                type="number"
                min={0}
                step={mode === "weekly_hours" ? 0.5 : 5}
                value={Number.isFinite(safeVal) ? String(safeVal) : ""}
                onChange={(e) => handleValueChange(e.currentTarget.value)}
              />
            </div>
          </div>

          <div
            className={[
              SURFACE_INLINE,
              "px-3 py-2 text-xs leading-relaxed opacity-80",
            ].join(" ")}
          >
            {previewText}
          </div>
        </div>
      )}
    </section>
  );
}
