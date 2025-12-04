// src/features/coach/components/prefs/GoalSection.tsx
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

// distance / race meta – musia sedieť s typmi v prefsTypes
const RACE_GOALS = ["5k", "10k", "half", "marathon", "ultra", "other"] as const;
const RACE_GOAL_LABEL: Record<(typeof RACE_GOALS)[number], string> = {
  "5k": "5 km",
  "10k": "10 km",
  half: "Half marathon",
  marathon: "Marathon",
  ultra: "Ultra",
  other: "Other / custom",
};

const PRIORITIES = ["A", "B", "C"] as const;

const RACE_TYPES = ["road", "trail", "track", "cross", "ocr", "other"] as const;
const RACE_TYPE_LABEL: Record<(typeof RACE_TYPES)[number], string> = {
  road: "Road",
  trail: "Trail",
  track: "Track",
  cross: "XC / cross",
  ocr: "OCR",
  other: "Other",
};

const TERRAIN = ["flat", "rolling", "hilly", "mountain"] as const;
const TERRAIN_LABEL: Record<(typeof TERRAIN)[number], string> = {
  flat: "Flat",
  rolling: "Rolling",
  hilly: "Hilly",
  mountain: "Mountain",
};

const ELEVATION = ["low", "moderate", "high"] as const;
const ELEVATION_LABEL: Record<(typeof ELEVATION)[number], string> = {
  low: "Low gain",
  moderate: "Moderate",
  high: "High gain",
};

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  upsertRunTargets: (patch: Partial<NonNullable<any["targets"]>["run"]>) => void;
};

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  const [open, setOpen] = useState(false);
  const activeGoal: (typeof ALL_GOALS)[number] | undefined = local.goal_kind;

  const runTargets = (local.targets?.run ?? {}) as any;

  // ---- closed preview ----
  const weeks = local.weeks ? `${local.weeks} weeks` : null;
  const cur = runTargets.current_best_time || null;
  const tgt = runTargets.target_time || null;
  const raceGoal = runTargets.race_goal as (typeof RACE_GOALS)[number] | undefined;
  const customKm = runTargets.custom_distance_km as number | null | undefined;
  const priority = runTargets.priority as "A" | "B" | "C" | undefined;
  const raceType = runTargets.race_type as string | undefined;
  const terrain = runTargets.terrain as string | undefined;

  const goalLabel = activeGoal ? GOAL_LABEL[activeGoal] : "None";

  const raceGoalLabel = (() => {
    if (!raceGoal) return null;
    if (raceGoal === "other" && customKm) return `${customKm} km (custom)`;
    return RACE_GOAL_LABEL[raceGoal] ?? raceGoal;
  })();

  const metaBits: string[] = [];
  if (raceGoalLabel) metaBits.push(raceGoalLabel);
  if (priority) metaBits.push(`Priority ${priority}`);
  if (raceType) metaBits.push(raceType);
  if (terrain) metaBits.push(terrain);

  const previewParts = [
    `Goal: ${goalLabel}`,
    weeks ? `in ${weeks}` : null,
    metaBits.length ? `Race: ${metaBits.join(" · ")}` : null,
    cur || tgt ? `Time: ${cur ?? "—"} → ${tgt ?? "—"}` : null,
  ].filter(Boolean);

  const previewText =
    previewParts.length > 0 ? previewParts.join(" | ") : "No goal set";

  const handleRaceGoalClick = (g: (typeof RACE_GOALS)[number]) => {
    const next = runTargets.race_goal === g ? null : g;
    const patch: any = { race_goal: next };
    // ak už nebudeme potrebovať custom km, vyčisti to
    if (next !== "other" && next !== "ultra") {
      patch.custom_distance_km = null;
    }
    upsertRunTargets(patch);
  };

  const showCustomDistance =
    raceGoal === "other" || raceGoal === "ultra";

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
          {/* High-level goal pills */}
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

          {/* Weeks + race distance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
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

            {/* Race distance pills (run target) */}
            <div className="sm:col-span-2 flex flex-wrap gap-1">
              {RACE_GOALS.map((rg) => (
                <Button
                  key={rg}
                  size="xs"
                  variant="prefs"
                  active={raceGoal === rg}
                  onClick={() => handleRaceGoalClick(rg)}
                >
                  {RACE_GOAL_LABEL[rg]}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom distance + times */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            {showCustomDistance && (
              <TextField
                placeholder="custom distance (km)"
                value={
                  runTargets.custom_distance_km != null
                    ? String(runTargets.custom_distance_km)
                    : ""
                }
                onChange={(e) => {
                  const v = e.currentTarget.value.trim();
                  upsertRunTargets({
                    custom_distance_km: v ? Number(v) || null : null,
                  });
                }}
                inputMode="decimal"
              />
            )}

            <TextField
              placeholder="current best (hh:mm:ss)"
              value={runTargets.current_best_time ?? ""}
              onChange={(e) =>
                upsertRunTargets({
                  current_best_time: e.currentTarget.value || null,
                })
              }
            />
            <TextField
              placeholder="target time (hh:mm:ss)"
              value={runTargets.target_time ?? ""}
              onChange={(e) =>
                upsertRunTargets({
                  target_time: e.currentTarget.value || null,
                })
              }
            />
          </div>

          {/* Priority + type / terrain / elevation */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {/* Priority A/B/C */}
            <div className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Race priority</span>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <Button
                    key={p}
                    size="xs"
                    variant="prefs"
                    active={runTargets.priority === p}
                    onClick={() =>
                      upsertRunTargets({
                        priority: runTargets.priority === p ? null : p,
                      })
                    }
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Race type */}
            <div className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Race type</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs"
                value={runTargets.race_type ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    race_type: e.currentTarget.value || null,
                  })
                }
              >
                <option value="">—</option>
                {RACE_TYPES.map((rt) => (
                  <option key={rt} value={rt}>
                    {RACE_TYPE_LABEL[rt]}
                  </option>
                ))}
              </select>
            </div>

            {/* Terrain */}
            <div className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Terrain</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs"
                value={runTargets.terrain ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    terrain: e.currentTarget.value || null,
                  })
                }
              >
                <option value="">—</option>
                {TERRAIN.map((t) => (
                  <option key={t} value={t}>
                    {TERRAIN_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {/* Elevation */}
            <div className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Elevation</span>
              <select
                className="w-full rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs"
                value={runTargets.elevation_profile ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    elevation_profile: e.currentTarget.value || null,
                  })
                }
              >
                <option value="">—</option>
                {ELEVATION.map((elev) => (
                  <option key={elev} value={elev}>
                    {ELEVATION_LABEL[elev]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </section>
  );
}