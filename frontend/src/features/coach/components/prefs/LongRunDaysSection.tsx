// src/features/coach/components/LongRunDaysSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import type { DayAbbrev } from "@/shared/types/day";
import { SECTION,  COLOR_PREFS_INACTIVE,COLOR_PREFS_ACTIVE, PILL_BUTTON } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

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

      {open && (
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = (longRunDays ?? []).includes(d);
            const next = toggleInArray(longRunDays ?? [], d);
            return (
              <Button
                key={d}
                type="button"
                size="xs"
                variant="secondary"
                onClick={() =>
                  setPrefNested("preferences.long_run_days", next as DayAbbrev[])
                }
                className={[PILL_BUTTON, active ? COLOR_PREFS_ACTIVE : COLOR_PREFS_INACTIVE].join(" ")}
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