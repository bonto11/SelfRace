// src/features/coach/components/prefs/GoalSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";

/* ─────────────────────── constants ─────────────────────── */

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

/* ─────────────────────── types ─────────────────────── */

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  upsertRunTargets: (patch: Partial<NonNullable<any["targets"]>["run"]>) => void;
};

/* ─────────────────────── component ─────────────────────── */

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  const [open, setOpen] = useState(false);
  const activeGoal: (typeof ALL_GOALS)[number] | undefined = local.goal_kind;

  const runTargets = (local.targets?.run ?? {}) as any;

  /* ---------- closed preview ---------- */

  const weeks = local.weeks ? `${local.weeks} weeks` : null;
  const cur = runTargets.current_best_time || null;
  const tgt = runTargets.target_time || null;

  const raceGoal = runTargets.race_goal as
    | (typeof RACE_GOALS)[number]
    | undefined;
  const customKm = runTargets.custom_distance_km as
    | number
    | null
    | undefined;

  const priority = runTargets.priority as "A" | "B" | "C" | null | undefined;

  // tu spravíme normálne union typy – kľúče do mapy
  const raceType = runTargets.race_type as
    | (typeof RACE_TYPES)[number]
    | null
    | undefined;
  const terrain = runTargets.terrain as
    | (typeof TERRAIN)[number]
    | null
    | undefined;
  const elevation = runTargets.elevation_profile as
    | (typeof ELEVATION)[number]
    | null
    | undefined;

  const goalLabel = activeGoal ? GOAL_LABEL[activeGoal] : "None";

  const raceGoalLabel = (() => {
    if (!raceGoal) return null;
    if (raceGoal === "other" && customKm) return `${customKm} km (custom)`;
    return RACE_GOAL_LABEL[raceGoal] ?? raceGoal;
  })();

  const metaBits: string[] = [];
  if (raceGoalLabel) metaBits.push(raceGoalLabel);
  if (priority) metaBits.push(`Priority ${priority}`);
  if (raceType) metaBits.push(RACE_TYPE_LABEL[raceType]);
  if (terrain) metaBits.push(TERRAIN_LABEL[terrain]);
  if (elevation) metaBits.push(ELEVATION_LABEL[elevation]);

  const previewParts = [
    `Goal: ${goalLabel}`,
    weeks ? `Horizon: ${weeks}` : null,
    metaBits.length ? `Race: ${metaBits.join(" · ")}` : null,
    cur || tgt ? `Time: ${cur ?? "—"} → ${tgt ?? "—"}` : null,
  ].filter(Boolean);

  const previewText =
    previewParts.length > 0 ? previewParts.join(" | ") : "No goal set";

  /* ---------- helpers ---------- */

  const handleRaceGoalClick = (g: (typeof RACE_GOALS)[number]) => {
    const next = runTargets.race_goal === g ? null : g;
    const patch: any = { race_goal: next };
    if (next !== "other" && next !== "ultra") {
      patch.custom_distance_km = null;
    }
    upsertRunTargets(patch);
  };

  const showCustomDistance = raceGoal === "other" || raceGoal === "ultra";

  /* ─────────────────────── render ─────────────────────── */

  return (
    <section className={SECTION}>
      {/* header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Goal</div>
        <div className="flex items-center gap-2">
          <div className="text-xs opacity-70 hidden sm:block">
            High-level goal & race target.
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
        <div className="space-y-4">
          {/* 1) High-level plan goal */}
          <div className="space-y-2">
            <div className="text-xs font-medium opacity-70">
              1. Overall training goal
            </div>
            <div className="flex flex-wrap gap-2">
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
          </div>

          {/* 2) Horizon + race distance */}
          <div className="space-y-2">
            <div className="text-xs font-medium opacity-70">
              2. Plan horizon & race distance
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextField
                label="Weeks until goal"
                placeholder="e.g. 8, 10, 12"
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

              <div className="sm:col-span-2 space-y-1">
                <div className="text-xs opacity-70">Target race distance</div>
                <div className="flex flex-wrap gap-1.5">
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
            </div>

            {showCustomDistance && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextField
                  label="Custom distance (km)"
                  placeholder="e.g. 7, 25, 50"
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
              </div>
            )}
          </div>

          {/* 3) Time targets */}
          <div className="space-y-2">
            <div className="text-xs font-medium opacity-70">
              3. Time goals (optional)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextField
                label="Current best (hh:mm:ss)"
                placeholder="e.g. 00:20:30"
                value={runTargets.current_best_time ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    current_best_time: e.currentTarget.value || null,
                  })
                }
              />
              <TextField
                label="Target time (hh:mm:ss)"
                placeholder="e.g. 00:19:00"
                value={runTargets.target_time ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    target_time: e.currentTarget.value || null,
                  })
                }
              />
            </div>
          </div>

          {/* 4) Race details */}
          <div className="space-y-2">
            <div className="text-xs font-medium opacity-70">
              4. Race details (for planning specificity)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* priority */}
              <div>
                <div className="text-xs opacity-70 mb-1">Race priority</div>
                <div className="flex flex-wrap gap-1.5">
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

              {/* type */}
              <SelectField
                label="Race type"
                value={raceType ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    race_type: e.currentTarget.value || null,
                  })
                }
                options={[
                  { value: "", label: "—" },
                  ...RACE_TYPES.map((rt) => ({
                    value: rt,
                    label: RACE_TYPE_LABEL[rt],
                  })),
                ]}
              />

              {/* terrain */}
              <SelectField
                label="Terrain"
                value={terrain ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    terrain: e.currentTarget.value || null,
                  })
                }
                options={[
                  { value: "", label: "—" },
                  ...TERRAIN.map((t) => ({
                    value: t,
                    label: TERRAIN_LABEL[t],
                  })),
                ]}
              />

              {/* elevation */}
              <SelectField
                label="Elevation profile"
                value={elevation ?? ""}
                onChange={(e) =>
                  upsertRunTargets({
                    elevation_profile: e.currentTarget.value || null,
                  })
                }
                options={[
                  { value: "", label: "—" },
                  ...ELEVATION.map((ev) => ({
                    value: ev,
                    label: ELEVATION_LABEL[ev],
                  })),
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}