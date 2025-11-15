"use client";

import type { DayAbbrev } from "@/shared/types/day";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

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
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Preferred long-run days
        </div>
        <InfoPopover text="Pick preferred days (or none)." />
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_DAYS.map((d) => {
          const active = (longRunDays ?? []).includes(d);
          const next = toggleInArray(longRunDays ?? [], d);
          return (
            <button
              key={d}
              onClick={() =>
                setPrefNested("preferences.long_run_days", next as DayAbbrev[])
              }
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