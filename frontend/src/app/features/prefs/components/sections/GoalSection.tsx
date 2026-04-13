// src/features/coach/components/prefs/GoalSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import InputsCard from "@/app/shared/ui/components/InputsCard";
// ✅ Import našich nových inteligentných bubnov
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
import TimeSelectorField from "@/app/shared/ui/components/TimeSelectorField";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_STACK, INPUTS_CARD_BODY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─────────────────────── constants ─────────────────────── */

const OVERALL_GOALS = [
  "improve_speed",
  "improve_endurance",
  "improve_overall",
  "maintain",
] as const;

const RACE_GOALS = ["5k", "10k", "half", "marathon", "ultra", "other"] as const;
const PRIORITIES = ["A", "B", "C"] as const;
const RACE_TYPES = [
  "road",
  "trail",
  "track",
  "cross",
  "hyrox",
  "ocr",
  "other",
] as const;
const TERRAIN = ["flat", "rolling", "hilly", "mountain"] as const;
const ELEVATION = ["low", "moderate", "high"] as const;

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
  upsertRunTargets: (
    patch: Partial<NonNullable<any["targets"]>["run"]>,
  ) => void;
};

/* ─────────────────────── component ─────────────────────── */

export function GoalSection({ local, setPref, upsertRunTargets }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const overallGoal: (typeof OVERALL_GOALS)[number] | undefined =
    local.goal_kind;
  const runTargets = (local.targets?.run ?? {}) as any;

  const races: any[] = useMemo(
    () => (Array.isArray(runTargets.races) ? runTargets.races : []),
    [runTargets.races],
  );

  /* ---------- labels mapping ---------- */

  const getOverallLabel = (g: string) =>
    (t as any)(`prefs.sections.goalSection.enums.overall.${g}`);
  const getRaceGoalLabel = (rg: string) =>
    (t as any)(`prefs.sections.goalSection.enums.race.${rg}`);
  const getRaceTypeLabel = (rt: string) =>
    (t as any)(`prefs.sections.goalSection.enums.type.${rt}`);
  const getTerrainLabel = (terr: string) =>
    (t as any)(`prefs.sections.goalSection.enums.terrain.${terr}`);
  const getElevationLabel = (elev: string) =>
    (t as any)(`prefs.sections.goalSection.enums.elevation.${elev}`);

  /* ---------- closed preview ---------- */

  const aRace =
    races.find((r) => r.priority === "A") ??
    (races.length > 0 ? races[0] : null);

  const racePreview = aRace
    ? (() => {
        const parts: string[] = [];
        if (aRace.priority)
          parts.push(
            `${t("prefs.sections.goalSection.previewPriority")} ${aRace.priority}`,
          );

        const rg = aRace.race_goal as (typeof RACE_GOALS)[number] | null;
        const customKm = aRace.custom_distance_km as number | null;
        if (rg) {
          if (rg === "other" && customKm) parts.push(`${customKm} km`);
          else parts.push(getRaceGoalLabel(rg));
        }

        if (aRace.date) parts.push(String(aRace.date));

        const rt = aRace.race_type as (typeof RACE_TYPES)[number] | null;
        if (rt) parts.push(getRaceTypeLabel(rt));

        return parts.join(" · ");
      })()
    : null;

  const overallLabel = overallGoal
    ? getOverallLabel(overallGoal)
    : t("prefs.sections.goalSection.none");

  const previewParts = [
    `${t("prefs.sections.goalSection.previewGoal")}: ${overallLabel}`,
    racePreview
      ? `${t("prefs.sections.goalSection.previewKeyRace")}: ${racePreview}`
      : null,
  ].filter(Boolean);

  const previewText =
    previewParts.length > 0
      ? previewParts.join(" | ")
      : t("prefs.sections.goalSection.previewNoGoal");

  /* ---------- helpers / mutators ---------- */

  const updateRunTargets = (patch: any) => upsertRunTargets(patch);

  const syncMainRaceToTargets = (racesNext: any[]) => {
    const main =
      racesNext.find((r) => r.priority === "A") ??
      (racesNext.length > 0 ? racesNext[0] : null);

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

    if (patch.priority === "A") {
      for (let i = 0; i < next.length; i += 1) {
        if (i !== index && next[i].priority === "A")
          next[i] = { ...next[i], priority: null };
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

  const handleRaceGoalClick = (
    index: number,
    g: (typeof RACE_GOALS)[number],
  ) => {
    const race = races[index] ?? {};
    const current = race.race_goal as (typeof RACE_GOALS)[number] | null;
    const nextGoal = current === g ? null : g;

    const patch: any = { race_goal: nextGoal };
    if (nextGoal !== "other" && nextGoal !== "ultra")
      patch.custom_distance_km = null;

    updateRaceAt(index, patch);
  };

  /* ─────────────────────── render ─────────────────────── */

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.goalSection.title")}</span>
          <TooltipIcon text={t("prefs.sections.goalSection.widget.tooltip")} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.goalSection.subtitle")}
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
              <span>{t("prefs.sections.goalSection.racesTitle")}</span>
              <TooltipIcon
                text={t("prefs.sections.goalSection.racesTooltip")}
              />
            </div>

            <Button size="xs" variant="success" onClick={addRace}>
              {t("prefs.sections.goalSection.addBtn")}
            </Button>
          </div>

          {races.length === 0 && (
            <div className="text-xs opacity-60">
              {t("prefs.sections.goalSection.noRaces")}
            </div>
          )}

          <div className="space-y-4">
            {races.map((race, index) => {
              const raceGoal = race.race_goal as
                | (typeof RACE_GOALS)[number]
                | null
                | undefined;
              const showCustom = raceGoal === "other" || raceGoal === "ultra";

              const rt = race.race_type as
                | (typeof RACE_TYPES)[number]
                | null
                | undefined;
              const terr = race.terrain as
                | (typeof TERRAIN)[number]
                | null
                | undefined;
              const elev = race.elevation_profile as
                | (typeof ELEVATION)[number]
                | null
                | undefined;

              return (
                <div
                  key={race.id ?? index}
                  className="rounded-xl border border-white/10 px-3 py-3 space-y-3 bg-black/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <TextField
                      containerClassName="flex-1"
                      label={t(
                        "prefs.sections.goalSection.raceNameLabel",
                      ).replace("{{index}}", String(index + 1))}
                      placeholder={t(
                        "prefs.sections.goalSection.raceNamePlaceholder",
                      )}
                      value={race.name ?? ""}
                      onChange={(e) =>
                        updateRaceAt(index, {
                          name: e.currentTarget.value || null,
                        })
                      }
                    />

                    <Button
                      size="xs"
                      variant="danger"
                      onClick={() => removeRace(index)}
                    >
                      {t("prefs.sections.goalSection.removeBtn")}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-xs opacity-70 mb-1">
                        {t("prefs.sections.goalSection.dateLabel")}
                      </div>
                      <DateField
                        value={(race.date as string | null) ?? null}
                        onChange={(v) =>
                          updateRaceAt(index, { date: v || null })
                        }
                        variant="editable"
                      />
                    </div>

                    <SelectField
                      label={t("prefs.sections.goalSection.priorityLabel")}
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

                    <TimeSelectorField
                      label={t("prefs.sections.goalSection.targetTimeLabel")}
                      hh={true}
                      mm={true}
                      ss={true}
                      value={race.target_time ?? "00:00:00"}
                      onChange={(v) =>
                        updateRaceAt(index, {
                          target_time: v !== "00:00:00" ? v : null,
                        })
                      }
                    />

                    <NumberWheelField
                      // ✅ Jednotka pridaná priamo do labelu
                      label={`${t("prefs.sections.goalSection.elevationGainLabel")} (m)`}
                      min={0}
                      max={10000}
                      step={50}
                      value={race.elevation_gain_m ?? ""}
                      onChange={(val) =>
                        updateRaceAt(index, {
                          elevation_gain_m: val,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <span>
                        {t("prefs.sections.goalSection.distTerrainTitle")}
                      </span>
                      <TooltipIcon
                        text={t(
                          "prefs.sections.goalSection.distTerrainTooltip",
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2 space-y-1">
                        <div className="text-xs opacity-70">
                          {t("prefs.sections.goalSection.targetDistLabel")}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {RACE_GOALS.map((rg) => (
                            <Button
                              key={rg}
                              size="xs"
                              variant="prefs"
                              active={raceGoal === rg}
                              onClick={() => handleRaceGoalClick(index, rg)}
                            >
                              {getRaceGoalLabel(rg)}
                            </Button>
                          ))}
                        </div>

                        {showCustom && (
                          <div className="mt-2">
                            {/* ✅ Nahradené za NumberWheelField pre Vlastnú vzdialenosť */}
                            <NumberWheelField
                              label={t(
                                "prefs.sections.goalSection.customDistLabel",
                              )}
                              min={1}
                              max={300}
                              step={1}
                              value={race.custom_distance_km ?? ""}
                              onChange={(val) =>
                                updateRaceAt(index, {
                                  custom_distance_km: val,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>

                      <SelectField
                        label={t("prefs.sections.goalSection.raceTypeLabel")}
                        value={rt ?? ""}
                        onChange={(e) =>
                          updateRaceAt(index, {
                            race_type: e.currentTarget.value || null,
                          })
                        }
                        options={[
                          { value: "", label: "—" },
                          ...RACE_TYPES.map((t) => ({
                            value: t,
                            label: getRaceTypeLabel(t),
                          })),
                        ]}
                      />

                      <div className="space-y-2">
                        <SelectField
                          label={t("prefs.sections.goalSection.terrainLabel")}
                          value={terr ?? ""}
                          onChange={(e) =>
                            updateRaceAt(index, {
                              terrain: e.currentTarget.value || null,
                            })
                          }
                          options={[
                            { value: "", label: "—" },
                            ...TERRAIN.map((t) => ({
                              value: t,
                              label: getTerrainLabel(t),
                            })),
                          ]}
                        />

                        <SelectField
                          label={t(
                            "prefs.sections.goalSection.elevationProfileLabel",
                          )}
                          value={elev ?? ""}
                          onChange={(e) =>
                            updateRaceAt(index, {
                              elevation_profile: e.currentTarget.value || null,
                            })
                          }
                          options={[
                            { value: "", label: "—" },
                            ...ELEVATION.map((t) => ({
                              value: t,
                              label: getElevationLabel(t),
                            })),
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
            <span>{t("prefs.sections.goalSection.overallTitle")}</span>
            <TooltipIcon
              text={t("prefs.sections.goalSection.overallTooltip")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {OVERALL_GOALS.map((g) => (
              <Button
                key={g}
                size="sm"
                variant="prefs"
                active={overallGoal === g}
                onClick={() =>
                  setPref("goal_kind", overallGoal === g ? undefined : g)
                }
              >
                {getOverallLabel(g)}
              </Button>
            ))}

            <Button
              size="sm"
              variant="prefs"
              active={!overallGoal}
              onClick={() => setPref("goal_kind", undefined)}
            >
              {t("prefs.sections.goalSection.none")}
            </Button>
          </div>
        </div>
      </div>
    </InputsCard>
  );
}
