// src/features/coach/components/prefs/GoalSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import InputsCard from "@/app/shared/ui/components/InputsCard";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_STACK, INPUTS_CARD_BODY } from "@/app/shared/ui/tokens";

/* ─────────────────────── constants ─────────────────────── */

const OVERALL_GOALS = [
  "improve_speed",
  "improve_endurance",
  "improve_overall",
  "maintain",
] as const;

const OVERALL_LABEL: Record<(typeof OVERALL_GOALS)[number], string> = {
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

/* ─────────────────────── helpers ─────────────────────── */

function makeRaceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      // ignore
    }
  }
  return `race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const emptyRace = () => ({
  id: makeRaceId(),
  name: "",
  date: null as string | null,
  priority: null as "A" | "B" | "C" | null,
  race_goal: null as (typeof RACE_GOALS)[number] | null,
  custom_distance_km: null as number | null,
  target_time: null as string | null,
  race_type: null as (typeof RACE_TYPES)[number] | null,
  terrain: null as (typeof TERRAIN)[number] | null,
  elevation_profile: null as (typeof ELEVATION)[number] | null,
  elevation_gain_m: null as number | null,
});

/* ─────────────────────── types ─────────────────────── */

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  upsertRunTargets: (patch: Partial<NonNullable<any["targets"]>["run"]>) => void;
};

/* ─────────────────────── component ─────────────────────── */

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  const [open, setOpen] = useState(false);

  const overallGoal: (typeof OVERALL_GOALS)[number] | undefined = local.goal_kind;
  const runTargets = (local.targets?.run ?? {}) as any;

  const races: any[] = useMemo(
    () => (Array.isArray(runTargets.races) ? runTargets.races : []),
    [runTargets.races],
  );

  /* ---------- closed preview ---------- */

  const aRace =
    races.find((r) => r.priority === "A") ?? (races.length > 0 ? races[0] : null);

  const racePreview = aRace
    ? (() => {
        const parts: string[] = [];
        if (aRace.priority) parts.push(`Priority ${aRace.priority}`);

        const rg = aRace.race_goal as (typeof RACE_GOALS)[number] | null;
        const customKm = aRace.custom_distance_km as number | null;
        if (rg) {
          if (rg === "other" && customKm) parts.push(`${customKm} km`);
          else parts.push(RACE_GOAL_LABEL[rg] ?? rg);
        }

        if (aRace.date) parts.push(String(aRace.date));

        const rt = aRace.race_type as (typeof RACE_TYPES)[number] | null;
        if (rt) parts.push(RACE_TYPE_LABEL[rt]);

        return parts.join(" · ");
      })()
    : null;

  const overallLabel = overallGoal ? OVERALL_LABEL[overallGoal] : "None";

  const previewParts = [
    `Goal: ${overallLabel}`,
    racePreview ? `Key race: ${racePreview}` : null,
  ].filter(Boolean);

  const previewText = previewParts.length > 0 ? previewParts.join(" | ") : "No goal set";

  /* ---------- helpers / mutators ---------- */

  const updateRunTargets = (patch: any) => upsertRunTargets(patch);

  const syncMainRaceToTargets = (racesNext: any[]) => {
    const main =
      racesNext.find((r) => r.priority === "A") ?? (racesNext.length > 0 ? racesNext[0] : null);

    if (!main) {
      updateRunTargets({
        races: racesNext,
        race_goal: null,
        custom_distance_km: null,
        target_time: null,
        race_type: null,
        terrain: null,
        elevation_profile: null,
      });
      return;
    }

    updateRunTargets({
      races: racesNext,
      race_goal: main.race_goal ?? null,
      custom_distance_km: main.custom_distance_km ?? null,
      target_time: main.target_time ?? null,
      race_type: main.race_type ?? null,
      terrain: main.terrain ?? null,
      elevation_profile: main.elevation_profile ?? null,
    });
  };

  const updateRaceAt = (index: number, patch: any) => {
    const cur = Array.isArray(races) ? races : [];
    const next = cur.map((r, i) => (i === index ? { ...r, ...patch } : r));

    // max jedno "A"
    if (patch.priority === "A") {
      for (let i = 0; i < next.length; i += 1) {
        if (i !== index && next[i].priority === "A") next[i] = { ...next[i], priority: null };
      }
    }

    syncMainRaceToTargets(next);
  };

  const addRace = () => {
    const cur = Array.isArray(races) ? races : [];
    const hasA = cur.some((r) => r.priority === "A");
    const base = emptyRace();
    const nextRace = { ...base, priority: hasA ? null : "A" };
    syncMainRaceToTargets([...cur, nextRace]);
  };

  const removeRace = (index: number) => {
    const cur = Array.isArray(races) ? races : [];
    const next = cur.filter((_: any, i: number) => i !== index);
    syncMainRaceToTargets(next);
  };

  const handleRaceGoalClick = (index: number, g: (typeof RACE_GOALS)[number]) => {
    const race = races[index] ?? {};
    const current = race.race_goal as (typeof RACE_GOALS)[number] | null;
    const nextGoal = current === g ? null : g;

    const patch: any = { race_goal: nextGoal };
    if (nextGoal !== "other" && nextGoal !== "ultra") patch.custom_distance_km = null;

    updateRaceAt(index, patch);
  };

  /* ─────────────────────── render ─────────────────────── */

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Goal</span>
          <TooltipIcon
            text={
              "Key races (A/B/C) + overall training goal.\n\n" +
              "A-race = najdôležitejší cieľ, podľa neho sa plán najviac prispôsobí."
            }
          />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          Key races & overall training goal.
        </span>
      }
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* 1. KEY RACES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium opacity-70">
              <span>1. Key races (A/B/C)</span>
              <TooltipIcon text="Pridaj preteky, ktoré chceš cieliť. A = hlavný cieľ, B/C = doplnkové." />
            </div>

            <Button size="xs" variant="success" onClick={addRace}>
              Add race
            </Button>
          </div>

          {races.length === 0 && (
            <div className="text-xs opacity-60">
              No races yet. Add at least one A-race if máš konkrétny cieľ.
            </div>
          )}

          <div className="space-y-4">
            {races.map((race, index) => {
              const raceGoal = race.race_goal as (typeof RACE_GOALS)[number] | null | undefined;
              const showCustom = raceGoal === "other" || raceGoal === "ultra";

              const rt = race.race_type as (typeof RACE_TYPES)[number] | null | undefined;
              const terr = race.terrain as (typeof TERRAIN)[number] | null | undefined;
              const elev = race.elevation_profile as (typeof ELEVATION)[number] | null | undefined;

              return (
                <div
                  key={race.id ?? index}
                  className="rounded-xl border border-white/10 px-3 py-3 space-y-3 bg-black/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <TextField
                      containerClassName="flex-1"
                      label={`Race ${index + 1} name (optional)`}
                      placeholder="e.g. Bratislava 10k"
                      value={race.name ?? ""}
                      onChange={(e) =>
                        updateRaceAt(index, { name: e.currentTarget.value || null })
                      }
                    />

                    <Button size="xs" variant="danger" onClick={() => removeRace(index)}>
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs opacity-70 mb-1">Race date</div>
                      <DateField
                        value={(race.date as string | null) ?? null}
                        onChange={(v) => updateRaceAt(index, { date: v || null })}
                        variant="editable"
                      />
                    </div>

                    <SelectField
                      label="Race priority"
                      value={race.priority ?? ""}
                      onChange={(e) =>
                        updateRaceAt(index, {
                          priority: e.currentTarget.value
                            ? (e.currentTarget.value as "A" | "B" | "C")
                            : null,
                        })
                      }
                      options={[
                        { value: "", label: "—" },
                        ...PRIORITIES.map((p) => ({ value: p, label: p })),
                      ]}
                    />

                    <TextField
                      label="Target time (hh:mm:ss)"
                      placeholder="e.g. 00:39:00"
                      value={race.target_time ?? ""}
                      onChange={(e) =>
                        updateRaceAt(index, { target_time: e.currentTarget.value || null })
                      }
                    />

                    <TextField
                      label="Elevation gain (m)"
                      placeholder="e.g. 1200"
                      value={race.elevation_gain_m != null ? String(race.elevation_gain_m) : ""}
                      onChange={(e) => {
                        const v = e.currentTarget.value.trim();
                        updateRaceAt(index, { elevation_gain_m: v ? Number(v) || null : null });
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <span>Distance & terrain</span>
                      <TooltipIcon text="Vyber distance + typ povrchu/terén. Pomáha to coachovi stavať špecifické tréningy." />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <div className="text-xs opacity-70">Target race distance</div>

                        <div className="flex flex-wrap gap-1.5">
                          {RACE_GOALS.map((rg) => (
                            <Button
                              key={rg}
                              size="xs"
                              variant="prefs"
                              active={raceGoal === rg}
                              onClick={() => handleRaceGoalClick(index, rg)}
                            >
                              {RACE_GOAL_LABEL[rg]}
                            </Button>
                          ))}
                        </div>

                        {showCustom && (
                          <div className="mt-2">
                            <TextField
                              label="Custom distance (km)"
                              placeholder="e.g. 7, 25, 50"
                              value={
                                race.custom_distance_km != null
                                  ? String(race.custom_distance_km)
                                  : ""
                              }
                              onChange={(e) => {
                                const v = e.currentTarget.value.trim();
                                updateRaceAt(index, {
                                  custom_distance_km: v ? Number(v) || null : null,
                                });
                              }}
                              inputMode="decimal"
                            />
                          </div>
                        )}
                      </div>

                      <SelectField
                        label="Race type"
                        value={rt ?? ""}
                        onChange={(e) =>
                          updateRaceAt(index, { race_type: e.currentTarget.value || null })
                        }
                        options={[
                          { value: "", label: "—" },
                          ...RACE_TYPES.map((t) => ({ value: t, label: RACE_TYPE_LABEL[t] })),
                        ]}
                      />

                      <div className="space-y-2">
                        <SelectField
                          label="Terrain"
                          value={terr ?? ""}
                          onChange={(e) =>
                            updateRaceAt(index, { terrain: e.currentTarget.value || null })
                          }
                          options={[
                            { value: "", label: "—" },
                            ...TERRAIN.map((t) => ({ value: t, label: TERRAIN_LABEL[t] })),
                          ]}
                        />

                        <SelectField
                          label="Elevation profile"
                          value={elev ?? ""}
                          onChange={(e) =>
                            updateRaceAt(index, { elevation_profile: e.currentTarget.value || null })
                          }
                          options={[
                            { value: "", label: "—" },
                            ...ELEVATION.map((t) => ({ value: t, label: ELEVATION_LABEL[t] })),
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. OVERALL GOAL */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-medium opacity-70">
            <span>2. Overall training goal</span>
            <TooltipIcon text="Toto je všeobecný smer tréningu. Ak máš A-race, plán sa aj tak najviac prispôsobí jemu." />
          </div>

          <div className="flex flex-wrap gap-2">
            {OVERALL_GOALS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant="prefs"
                active={overallGoal === g}
                onClick={() => setPref("goal_kind", overallGoal === g ? undefined : g)}
              >
                {OVERALL_LABEL[g]}
              </Button>
            ))}

            <Button size="sm" variant="prefs" active={!overallGoal} onClick={() => setPref("goal_kind", undefined)}>
              None
            </Button>
          </div>
        </div>
      </div>
    </InputsCard>
  );
}