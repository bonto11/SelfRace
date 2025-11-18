"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import {
  SECTION,
  PREFS_PILL,
  COLOR_PREFS_INACTIVE,
  COLOR_PREFS_ACTIVE,
} from "@/shared/ui/classes";

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
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex items-center gap-2">
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen(!open)}
            labelWhenOpen="Collapse Goal section"
            labelWhenClosed="Expand Goal section"
          />
        </div>
      </div>

      {/* Body */}
      {open && (
        <>
          {/* goal pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_GOALS.map((g) => {
              const isActive = activeGoal === g;
              return (
                <Button
                  key={g}
                  size="sm"
                  variant="ghost"
                  onClick={() => setPref("goal_kind", isActive ? undefined : g)}
                  className={[
                    PREFS_PILL,
                    isActive ? COLOR_PREFS_ACTIVE : COLOR_PREFS_INACTIVE,
                  ].join(" ")}
                >
                  {GOAL_LABEL[g]}
                </Button>
              );
            })}

            {/* explicit None */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPref("goal_kind", undefined)}
              className={[
                PREFS_PILL,
                !activeGoal ? COLOR_PREFS_ACTIVE : COLOR_PREFS_INACTIVE,
              ].join(" ")}
            >
              None
            </Button>
          </div>

          {/* detail fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <TextField
              placeholder="weeks (e.g. 8, 10, 12)"
              value={local.weeks ?? ""}
              onChange={(e) =>
                setPref(
                  "weeks",
                  e.currentTarget.value
                    ? Number(e.currentTarget.value)
                    : undefined
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