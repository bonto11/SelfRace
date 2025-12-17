// src/features/coach/components/prefs/VolumeSection.tsx
"use client";

import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import SelectField from "@/shared/components/ui/SelectField";
import TextField from "@/shared/components/ui/TextField";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import type {
  VolumeMode,
  VolumePrefs,
} from "@/features/coach/types/prefsTypes";

type Props = {
  volume?: VolumePrefs;
  // rovnaký pattern ako v SportsSection
  setPref: (key: any, value: any) => void;
};

export function VolumeSection({ volume, setPref }: Props) {
  const mode: VolumeMode = volume?.mode ?? "weekly_hours";
  const rawVal = volume?.value ?? null;

  const weeklyMin =
    rawVal == null || rawVal <= 0
      ? null
      : mode === "weekly_hours"
      ? Math.round(rawVal * 60)
      : Math.round(rawVal * 7);

  const weeklyHours = weeklyMin != null ? weeklyMin / 60 : null;
  const dailyMin = weeklyMin != null ? weeklyMin / 7 : null;

  const handleChange = (patch: Partial<VolumePrefs>) => {
    const next: VolumePrefs = {
      mode,
      value: rawVal,
      ...patch,
    };
    setPref("volume", next);
  };

  return (
    <section className={SECTION}>
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Training volume</div>
        <InfoPopover text="Koľko času vieš reálne trénovať naprieč všetkými športmi. Coach to berie ako mäkký strop pre týždenný objem." />
      </div>

      {/* body */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <div className="text-xs opacity-80 mb-1">Input mode</div>
          <SelectField
            value={mode}
            onChange={(e) =>
              handleChange({ mode: e.target.value as VolumeMode })
            }
            options={[
              { value: "weekly_hours", label: "Total weekly [h]" },
              { value: "daily_minutes", label: "Avg daily [min]" },
            ]}
          />
        </div>

        <div>
          <div className="text-xs opacity-80 mb-1">
            {mode === "weekly_hours" ? "Value [h / týždeň]" : "Value [min / deň]"}
          </div>
          <TextField
            type="number"
            min={0}
            step={0.5}
            value={rawVal ?? ""}
            onChange={(e) => {
              const vStr = e.currentTarget.value;
              const v =
                vStr === "" ? null : Number.isFinite(Number(vStr)) ? Number(vStr) : null;
              handleChange({ value: v });
            }}
          />
        </div>

        <div className="md:col-span-1 flex items-end">
          <div className={[SURFACE_INLINE, "w-full px-3 py-2 text-xs"].join(" ")}>
            {weeklyMin && weeklyMin > 0 ? (
              <>
                ≈ {weeklyHours!.toFixed(1)} h / týždeň • ≈{" "}
                {Math.round(dailyMin!)} min / deň.
              </>
            ) : (
              <>
                Ak necháš prázdne, AI si odhadne objem z histórie. Môže však ísť
                vyššie, než ti reálne vyhovuje.
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}