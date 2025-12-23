// src/features/coach/components/LongRunDaysSection.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import type { DayAbbrev } from "@/app/shared/types/day";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  longRunDays: DayAbbrev[] | undefined;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
  setPrefNested: (path: "preferences.long_run_days", v: DayAbbrev[]) => void;
};

export function LongRunDaysSection({
  longRunDays,
  toggleInArray,
  setPrefNested,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = longRunDays ?? [];
  const previewText = selected.length > 0 ? `${selected.join(", ")}` : "none";

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Preferred long-run days
        </div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Pick preferred days (or none)." />
          <DisclosureToggle open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>

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
                onClick={() => setPrefNested("preferences.long_run_days", next)}
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
