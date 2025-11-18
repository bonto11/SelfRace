"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import type { DayAbbrev } from "@/shared/types/day";
import { SECTION } from "@/shared/ui/classes";
import { InfoPopover } from "../InfoPopover";

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

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Days off</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Toggle any days. You can also select none." />
          <DisclosureToggle open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = (daysOff ?? []).includes(d);
            const next = toggleInArray(daysOff ?? [], d) as DayAbbrev[];
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