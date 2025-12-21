"use client";

import Button from "@/app/shared/components/ui/Button";
import { SECTION } from "@/app/shared/ui/classes";
import { inputClass } from "@/app/shared/ui";

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function PlanStartSection({ local, setLocal, markDirty }: Props) {
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Plan start</div>
        <div className="text-xs opacity-70">Min: {MIN_PLAN_START()}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="date"
          value={local.start_date ?? ""}
          min={MIN_PLAN_START()}
          onChange={(e) => {
            markDirty();
            setLocal((p) => ({
              ...p,
              start_date: (e.target as HTMLInputElement).value,
            }));
          }}
          className={inputClass}
        />
        <Button
          variant="secondary"
          onClick={() => {
            markDirty();
            setLocal((p) => ({ ...p, start_date: DEFAULT_PLAN_START() }));
          }}
        >
          Set default (D+2)
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            markDirty();
            setLocal((p) => ({ ...p, start_date: MIN_PLAN_START() }));
          }}
        >
          Start tomorrow
        </Button>
      </div>
    </section>
  );
}
