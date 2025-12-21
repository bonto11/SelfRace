// src/features/coach/components/FocusAvoidSection.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";

const FOCUS_CHOICES = [
  "ankle_strength",
  "foot_intrinsics",
  "calf_strength",
  "hamstrings",
  "glutes",
  "core_stability",
  "thoracic_mobility",
  "shoulder_stability",
] as const;

const AVOID_CHOICES = [
  "impact_high",
  "downhill_runs",
  "hard_surfaces",
  "back_to_back_speed",
] as const;

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
};

export function FocusAvoidSection({ local, setPref, toggleInArray }: Props) {
  const [open, setOpen] = useState(false);

  const focusArr = (local.focus_areas as string[] | undefined) ?? [];
  const avoidArr = (local.avoid_zones as string[] | undefined) ?? [];

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Focus & avoid</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Pick strength/mobility focus areas and elements to avoid; planner will adapt sessions." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Focus & Avoid"
            labelWhenClosed="Expand Focus & Avoid"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          Focus: {focusArr.length || 0} · Avoid: {avoidArr.length || 0}
        </div>
      )}

      {/* Body */}
      {open && (
        <>
          {/* Focus */}
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs opacity-80">Focus areas</div>
            <InfoPopover text="Areas to emphasize in plans (strength, mobility, stability)." />
          </div>
          <div className="flex flex-wrap gap-2">
            {FOCUS_CHOICES.map((k) => {
              const active = focusArr.includes(k);
              const next = toggleInArray(focusArr, k);
              return (
                <Button
                  key={k}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPref("focus_areas", next)}
                >
                  {k}
                </Button>
              );
            })}
          </div>

          {/* Avoid */}
          <div className="mt-3 mb-1 flex items-center justify-between">
            <div className="text-xs opacity-80">Avoid</div>
            <InfoPopover text="Elements to reduce/avoid (impact, downhills, hard surfaces, etc.)." />
          </div>
          <div className="flex flex-wrap gap-2">
            {AVOID_CHOICES.map((k) => {
              const active = avoidArr.includes(k);
              const next = toggleInArray(avoidArr, k);
              return (
                <Button
                  key={k}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPref("avoid_zones", next)}
                >
                  {k}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
