// src/features/coach/components/CoachPersonalitySection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INSET, SURFACE_INLINE } from "@/shared/ui/classes";
import { clamp01, PERSONA_TONES } from "@/features/coach/utils/persona";
import type { CoachPersona } from "@/features/coach/types/prefsTypes";
import { InfoPopover } from "../InfoPopover";

type CoachPersonalitySectionProps = {
  local: any;
  setPref: (key: any, val: any) => void;
  markDirty: () => void;
};

export function CoachPersonalitySection({
  local,
  setPref,
  markDirty,
}: CoachPersonalitySectionProps) {
  const [open, setOpen] = useState(false);

  const tone =
    local.coach_tone ??
    ({
      directness: 50,
      praise: 50,
      challenge: 50,
      emoji: 20,
      explain: 60,
    } as const);

  const personaOptions: { key: CoachPersona | null; label: string }[] = [
    { key: null, label: "None" },
    { key: "drill_sergeant", label: "Drill Sergeant" },
    { key: "motivator", label: "Motivator" },
    { key: "analyst", label: "Analyst" },
    { key: "realist", label: "Realist" },
    // 'custom' je mimo tejto mapy (zobrazujeme zvlášť)
  ];

  const voice: CoachPersona | "custom" | null =
    (local.coach_voice as CoachPersona | "custom" | null) ?? null;

  const previewText = (() => {
    if (voice === null) return "None";
    if (voice === "custom") return "Custom";
    const lbl = personaOptions.find((o) => o.key === voice)?.label ?? voice;
    return `${lbl}`;
  })();

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Coach personality</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Presets lock sliders · Custom unlocks · None disables" />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse coach personality"
            labelWhenClosed="Expand coach personality"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-80 select-none",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {/* Body */}
      {open && (
        <div className="space-y-3">
          {/* Persona pills */}
          <div className="flex flex-wrap gap-2">
            {/* None */}
            <Button
              type="button"
              size="sm"
              variant="prefs"
              active={voice === null}
              onClick={() => {
                markDirty();
                setPref("coach_voice", null);
              }}
            >
              None
            </Button>

            {/* Presets */}
            {personaOptions
              .filter((o) => o.key !== null)
              .map(({ key, label }) => {
                const active = voice === key;
                return (
                  <Button
                    key={label}
                    type="button"
                    size="sm"
                    variant="prefs"
                    active={active}
                    onClick={() => {
                      markDirty();
                      const personaKey = key as keyof typeof PERSONA_TONES;
                      setPref("coach_voice", key);
                      setPref("coach_tone", PERSONA_TONES[personaKey]);
                    }}
                  >
                    {label}
                  </Button>
                );
              })}

            {/* Custom */}
            <Button
              type="button"
              size="sm"
              variant="prefs"
              active={voice === "custom"}
              onClick={() => {
                markDirty();
                setPref("coach_voice", "custom");
                setPref(
                  "coach_tone",
                  local.coach_tone ?? {
                    directness: 50,
                    praise: 50,
                    challenge: 50,
                    emoji: 20,
                    explain: 60,
                  }
                );
              }}
            >
              Custom
            </Button>
          </div>

          {/* Sliders */}
          <div className="mt-1 grid grid-cols-1 gap-2">
            {(
              ["directness", "praise", "challenge", "emoji", "explain"] as const
            ).map((key) => {
              const v = Number((tone as any)[key] ?? 50);
              const locked = voice !== "custom";
              const disabled = voice == null;
              return (
                <div
                  key={key}
                  className={[
                    SURFACE_INSET,
                    "px-3 py-2 rounded-xl",
                    disabled && "opacity-50",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm capitalize">{key}</div>
                    <div className="text-sm tabular-nums opacity-80">
                      {Math.round(clamp01(v))}%
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(clamp01(v))}
                    disabled={locked || disabled}
                    onChange={(e) => {
                      const nv = Math.round(
                        clamp01(Number(e.currentTarget.value))
                      );
                      markDirty();
                      setPref("coach_tone", { ...tone, [key]: nv });
                    }}
                    className={[
                      "w-full mt-2",
                      locked || disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "opacity-100",
                      "accent-emerald-500",
                    ].join(" ")}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}