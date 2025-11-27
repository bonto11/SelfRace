// src/features/coach/components/DaysOffSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import type { DayAbbrev } from "@/shared/types/day";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  daysOff: DayAbbrev[] | undefined;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
  setPrefNested: (path: "preferences.days_off", v: DayAbbrev[]) => void;
};

export function DaysOffSection({
  daysOff,
  toggleInArray,
  setPrefNested,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = (daysOff ?? []) as DayAbbrev[];
  const previewText = selected.length
    ? `${selected.join(" · ")}`
    : "none";

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Days off</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Toggle any days. You can also select none." />
          <DisclosureToggle open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70 select-none"].join(" ")}
        >
          {previewText}
        </div>
      )}

      {/* Body */}
      {open && (
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = selected.includes(d);
            const next = toggleInArray(selected, d) as DayAbbrev[];
            return (
              <Button
                key={d}
                type="button"
                size="xs"
                variant="prefs"
                active={active}
                onClick={() => setPrefNested("preferences.days_off", next)}
              >
                {d}
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}