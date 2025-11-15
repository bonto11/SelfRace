"use client";

import type { DayAbbrev } from "@/shared/types/day";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

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
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Days off</div>
        <InfoPopover text="Toggle any days. You can also select none." />
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((d) => {
          const active = daysOff?.includes(d);
          const next = toggleInArray(daysOff, d);
          return (
            <button
              key={d}
              onClick={() => setPrefNested("preferences.days_off", next)}
              className={[
                PILL_BUTTON,
                active ? ACTIVE_PILL : "border-white/15",
              ].join(" ")}
            >
              {d}
            </button>
          );
        })}
      </div>
    </section>
  );
}