"use client";

import TextField from "@/shared/components/ui/TextField";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

const ALL_GOALS = [
  "race_time",
  "improve_speed",
  "improve_endurance",
  "improve_overall",
  "maintain",
] as const;

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  upsertRunTargets: (patch: Partial<NonNullable<any["targets"]>["run"]>) => void;
};

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="text-xs opacity-70">
          Pick the overall goal. Click again to clear.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_GOALS.map((g) => {
          const active = local.goal_kind === g;
          return (
            <button
              key={g}
              onClick={() => setPref("goal_kind", active ? undefined : g)}
              className={[
                PILL_BUTTON,
                active ? ACTIVE_PILL : "border-white/15",
              ].join(" ")}
            >
              {g}
            </button>
          );
        })}
        {/* explicit None */}
        <button
          onClick={() => setPref("goal_kind", undefined)}
          className={[
            PILL_BUTTON,
            !local.goal_kind ? ACTIVE_PILL : "border-white/15",
          ].join(" ")}
        >
          None
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <TextField
          placeholder="weeks (e.g. 8, 10, 12)"
          value={local.weeks ?? ""}
          onChange={(e) =>
            setPref(
              "weeks",
              (e.target as HTMLInputElement).value
                ? Number((e.target as HTMLInputElement).value)
                : undefined
            )
          }
          inputMode="numeric"
        />
        <TextField
          placeholder="current best (hh:mm:ss)"
          value={local.targets?.run.current_best_time ?? ""}
          onChange={(e) =>
            upsertRunTargets({
              current_best_time: (e.target as HTMLInputElement).value || null,
            })
          }
        />
        <TextField
          placeholder="target time (hh:mm:ss)"
          value={local.targets?.run.target_time ?? ""}
          onChange={(e) =>
            upsertRunTargets({
              target_time: (e.target as HTMLInputElement).value || null,
            })
          }
        />
      </div>
    </section>
  );
}