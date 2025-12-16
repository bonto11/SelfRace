// src/features/coach/components/prefs/VolumeSection.tsx
"use client";

import { useState, useMemo } from "react";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";

type VolumeInputMode = "weekly_hours" | "daily_minutes";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
};

export function VolumeSection({ local, setPref }: Props) {
  const [open, setOpen] = useState(false);

  const mode: VolumeInputMode = (local.volume_input_mode ??
    "weekly_hours") as VolumeInputMode;

  const rawValue =
    typeof local.volume_value === "number"
      ? local.volume_value
      : local.volume_value
      ? Number(local.volume_value)
      : NaN;

  const safeVal =
    Number.isFinite(rawValue) && rawValue > 0 ? (rawValue as number) : NaN;

  const { weeklyHours, dailyMinutes } = useMemo(() => {
    if (!Number.isFinite(safeVal) || safeVal <= 0) {
      return { weeklyHours: null as number | null, dailyMinutes: null as number | null };
    }

    if (mode === "weekly_hours") {
      const wh = safeVal;
      const dm = (wh * 60) / 7;
      return { weeklyHours: wh, dailyMinutes: dm };
    } else {
      // daily_minutes
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
    setPref("volume_input_mode", nextMode);
  };

  const handleValueChange = (v: string) => {
    if (!v) {
      setPref("volume_value", null);
      return;
    }
    const num = Number(v.replace(",", "."));
    if (Number.isNaN(num)) return;
    setPref("volume_value", num);
  };

  const valueLabel =
    mode === "weekly_hours"
      ? "Value [h / týždeň]"
      : "Value [min / deň]";

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