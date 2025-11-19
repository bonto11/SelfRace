// src/features/coach/components/GoalSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";

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

  // closed preview
  const weeks = local.weeks ? `${local.weeks}w` : null;
  const cur = local.targets?.run?.current_best_time || null;
  const tgt = local.targets?.run?.target_time || null;
  const goalLabel = activeGoal ? GOAL_LABEL[activeGoal] : "None";

  const previewParts = [
    `Goal: ${goalLabel}`,
    weeks ? `in ${weeks}` : null,
    cur || tgt ? `Time: ${cur ?? "—"} → ${tgt ?? "—"}` : null,
  ].filter(Boolean);

  const previewText =
    previewParts.length > 0 ? previewParts.join(" · ") : "No goal set";

  return (
    <section className={SECTION}>
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex items-center gap-2">
          <div className="text-xs opacity-70 hidden sm:block">
            Pick the goal. Click again to clear.
          </div>
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen(!open)}
            labelWhenOpen="Collapse Goal section"
            labelWhenClosed="Expand Goal section"
          />
        </div>
      </div>

      {/* closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {open && (
        <>
          {/* pills */}
          <div className="flex flex-wrap gap-2 mb-3">
            {ALL_GOALS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant="prefs"
                active={activeGoal === g}
                onClick={() =>
                  setPref("goal_kind", activeGoal === g ? undefined : g)
                }
              >
                {GOAL_LABEL[g]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="prefs"
              active={!activeGoal}
              onClick={() => setPref("goal_kind", undefined)}
            >
              None
            </Button>
          </div>

          {/* fields */}
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