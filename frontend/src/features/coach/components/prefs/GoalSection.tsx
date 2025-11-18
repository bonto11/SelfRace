// src/features/coach/components/GoalSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION } from "@/shared/ui/classes";

/** vizuálne konštanty pre aktívny/ neaktívny pilulový stav */
export const GOAL_ACTIVE_CLS =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";
export const GOAL_INACTIVE_CLS =
  "bg-white/10 text-white border border-white/15 hover:bg-white/16";

const ALL_GOALS = [
  "race_time",
  "improve_speed",
  "improve_endurance",
  "improve_overall",
  "maintain",
] as const;

const GOAL_LABEL: Record<(typeof ALL_GOALS)[number], string> = {
  race_time: "Race time",
  improve_speed: "Improve speed",
  improve_endurance: "Improve endurance",
  improve_overall: "Improve overall",
  maintain: "Maintain",
};

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  upsertRunTargets: (patch: Partial<NonNullable<any["targets"]>["run"]>) => void;
};

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  const [open, setOpen] = useState(false);
  const activeGoal: (typeof ALL_GOALS)[number] | undefined = local.goal_kind;

  return (
    <section className={SECTION}>
      {/* Hlavička + toggle vpravo */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex items-center gap-2">
          <div className="text-xs opacity-70 hidden sm:block">
            Pick the goal. Click again to clear.
          </div>
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Goal section"
            labelWhenClosed="Expand Goal section"
          />
        </div>
      </div>

      {/* Telo sekcie – zobraz len keď open === true */}
      {open && (
        <>
          {/* Pilulové prepínače cieľa */}
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_GOALS.map((g) => {
              const isActive = activeGoal === g;
              return (
                <Button
                  key={g}
                  size="sm"
                  variant="secondary"
                  onClick={() => setPref("goal_kind", isActive ? undefined : g)}
                  className={isActive ? GOAL_ACTIVE_CLS : GOAL_INACTIVE_CLS}
                >
                  {GOAL_LABEL[g]}
                </Button>
              );
            })}

            {/* explicit None */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPref("goal_kind", undefined)}
              className={!activeGoal ? GOAL_ACTIVE_CLS : GOAL_INACTIVE_CLS}
            >
              None
            </Button>
          </div>

          {/* Polia pre detail cieľa */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <TextField
              placeholder="weeks (e.g. 8, 10, 12)"
              value={local.weeks ?? ""}
              onChange={(e) =>
                setPref(
                  "weeks",
                  e.currentTarget.value ? Number(e.currentTarget.value) : undefined
                )
              }
              inputMode="numeric"
            />

            <TextField
              placeholder="current best (hh:mm:ss)"
              value={local.targets?.run?.current_best_time ?? ""}
              onChange={(e) =>
                upsertRunTargets({
                  current_best_time: e.currentTarget.value || null,
                })
              }
            />

            <TextField
              placeholder="target time (hh:mm:ss)"
              value={local.targets?.run?.target_time ?? ""}
              onChange={(e) =>
                upsertRunTargets({
                  target_time: e.currentTarget.value || null,
                })
              }
            />
          </div>
        </>
      )}
    </section>
  );
}