// src/features/coach/components/FocusAvoidSection.tsx
"use client";

import Button from "@/shared/components/ui/Button";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

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
  return (
    <section className={SECTION}>
      <div className="text-xs opacity-80 mb-1">Focus areas</div>
      <div className="flex flex-wrap gap-2">
        {FOCUS_CHOICES.map((k) => {
          const cur = (local.focus_areas as string[] | undefined) ?? [];
          const active = cur.includes(k);
          const next = toggleInArray(cur, k);
          return (
            <Button
              key={k}
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => setPref("focus_areas", next)}
              className={[active ? ACTIVE_PILL : "border-white/15", "px-2 py-1"].join(" ")}
            >
              {k}
            </Button>
          );
        })}
      </div>

      <div className="mt-3 text-xs opacity-80 mb-1">Avoid</div>
      <div className="flex flex-wrap gap-2">
        {AVOID_CHOICES.map((k) => {
          const cur = (local.avoid_zones as string[] | undefined) ?? [];
          const active = cur.includes(k);
          const next = toggleInArray(cur, k);
          return (
            <Button
              key={k}
              type="button"
              size="xs"
              variant="secondary"
              onClick={() => setPref("avoid_zones", next)}
              className={[active ? ACTIVE_PILL : "border-white/15", "px-2 py-1"].join(" ")}
            >
              {k}
            </Button>
          );
        })}
      </div>
    </section>
  );
}