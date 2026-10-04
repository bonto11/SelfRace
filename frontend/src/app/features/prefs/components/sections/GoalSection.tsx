// src/features/coach/components/prefs/GoalSection.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import NumberField from "@/app/shared/ui/components/NumberField";
import TimeField from "@/app/shared/ui/components/TimeField";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_STACK, INPUTS_CARD_BODY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import type { SportKind } from "@/app/features/prefs/types/prefs";

/* ─────────────────────── constants ─────────────────────── */

const SPORTS: SportKind[] = ["run", "ride", "swim"];

// Poradie: najprv ciele pre bežných ľudí, potom výkonnostné.
const OVERALL_GOALS = [
  "lose_weight",
  "health",
  "maintain",
  "improve_endurance",
  "improve_speed",
  "improve_overall",
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

  const getSportLabel = (s: SportKind) =>
    (t as any)(`prefs.sections.goalSection.enums.sport.${s}`);
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

  const mainSport: SportKind | null = (local.main_sport ?? null) as any;
  const mainSportLabel = mainSport ? getSportLabel(mainSport) : null;

  const previewParts = [
    mainSportLabel
      ? `${t("prefs.sections.goalSection.previewSport")}: ${mainSportLabel}`
      : null,
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

  // Preteky ako akordeón - otvorený je len jeden, nový sa otvorí hneď.
  const [openRaceId, setOpenRaceId] = useState<string | null>(null);
  const [showRaceDetails, setShowRaceDetails] = useState(false);

  const addRace = () => {
    const cur = Array.isArray(races) ? races : [];
    const hasA = cur.some((r) => r.priority === "A");
    const base = emptyRace();
    const nextRace = { ...base, priority: hasA ? null : "A" };
    syncMainRaceToTargets([...cur, nextRace]);
    setOpenRaceId(nextRace.id);
    setShowRaceDetails(false);
  };

  const raceDistanceLabel = (race: any): string | null => {
    const rg = race.race_goal as (typeof RACE_GOALS)[number] | null;
    if (!rg) return null;
    if ((rg === "other" || rg === "ultra") && race.custom_distance_km)
      return `${race.custom_distance_km} ${t("common.units.km")}`;
    return getRaceGoalLabel(rg);
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
        {/* 1. ČO CHCEŠ DOSIAHNUŤ - zrozumiteľné aj pre laika */}
        <div className="space-y-3">
          <div className="text-xs font-medium opacity-70">
            {t("prefs.sections.goalSection.overallTitle")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OVERALL_GOALS.map((g) => {
              const active = overallGoal === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setPref("goal_kind", active ? undefined : g)
                  }
                  className="text-left rounded-xl px-3 py-2.5 transition-colors"
                  style={{
                    border: `1.5px solid ${
                      active ? appColors.brandPrimary : appColors.surfaceCardBorder
                    }`,
                    background: active ? appColors.surfaceCard : "transparent",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: appColors.textPrimary,
                    }}
                  >
                    {getOverallLabel(g)}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: appColors.textMuted,
                      lineHeight: 1.35,
                    }}
                  >
                    {(t as any)(`prefs.sections.goalSection.enums.overallDesc.${g}`)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. HLAVNÝ ŠPORT */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium opacity-70">
            <span>{t("prefs.sections.goalSection.mainSportTitle")}</span>
            <TooltipIcon
              text={t("prefs.sections.goalSection.mainSportTooltip")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="prefs"
                active={mainSport === s}
                onClick={() => setPref("main_sport", s)}
              >
                {getSportLabel(s)}
              </Button>
            ))}
          </div>
        </div>

        {/* 3. PRETEKY - voliteľné, ako akordeón */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
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

          <div className="space-y-2">
            {races.map((race, index) => {
              const raceId: string = race.id ?? String(index);
              const isOpen = openRaceId === raceId;
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

              const summary = [
                race.date ? String(race.date) : null,
                raceDistanceLabel(race),
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={raceId}
                  className="rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${appColors.surfaceCardBorder}` }}
                >
                  {/* zbalený riadok: názov · dátum · dĺžka */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenRaceId(isOpen ? null : raceId);
                      setShowRaceDetails(false);
                    }}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <div
                        className="truncate"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: appColors.textPrimary,
                        }}
                      >
                        {race.priority === "A" ? "★ " : ""}
                        {race.name ||
                          t("prefs.sections.goalSection.raceFallbackName").replace(
                            "{{index}}",
                            String(index + 1),
                          )}
                      </div>
                      <div
                        className="truncate"
                        style={{ fontSize: 12, color: appColors.textMuted }}
                      >
                        {summary || t("prefs.sections.goalSection.raceIncomplete")}
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      color={appColors.textMuted}
                      style={{
                        flexShrink: 0,
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3">
                      <TextField
                        label={t("prefs.sections.goalSection.raceNameLabel").replace(
                          "{{index}}",
                          String(index + 1),
                        )}
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

                      <div className="space-y-1">
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
                            <NumberField
                              label={t(
                                "prefs.sections.goalSection.customDistLabel",
                              )}
                              min={1}
                              max={300}
                              step={1}
                              unit={t("common.units.km")}
                              value={race.custom_distance_km ?? ""}
                              onChange={(val) =>
                                updateRaceAt(index, {
                                  custom_distance_km: val === "" ? null : val,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* detaily trate - pre pokročilých, laik ich nepotrebuje */}
                      <button
                        type="button"
                        onClick={() => setShowRaceDetails((v) => !v)}
                        className="text-xs underline opacity-80"
                      >
                        {showRaceDetails
                          ? t("prefs.sections.goalSection.raceDetailsHide")
                          : t("prefs.sections.goalSection.raceDetailsShow")}
                      </button>

                      {showRaceDetails && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                          <div>
                            <div className="text-xs opacity-70 mb-1">
                              {t("prefs.sections.goalSection.targetTimeLabel")}
                            </div>
                            <TimeField
                              hh
                              mm
                              ss
                              value={race.target_time ?? ""}
                              onChange={(v) =>
                                updateRaceAt(index, {
                                  target_time: v || null,
                                })
                              }
                            />
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
                              ...RACE_TYPES.map((x) => ({
                                value: x,
                                label: getRaceTypeLabel(x),
                              })),
                            ]}
                          />

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
                              ...TERRAIN.map((x) => ({
                                value: x,
                                label: getTerrainLabel(x),
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
                              ...ELEVATION.map((x) => ({
                                value: x,
                                label: getElevationLabel(x),
                              })),
                            ]}
                          />

                          <div>
                            <div className="text-xs opacity-70 mb-1">
                              {t("prefs.sections.goalSection.elevationGainLabel")}
                            </div>
                            <NumberField
                              min={0}
                              max={10000}
                              step={50}
                              unit={t("common.units.meter")}
                              value={race.elevation_gain_m ?? ""}
                              onChange={(val) =>
                                updateRaceAt(index, {
                                  elevation_gain_m: val === "" ? null : val,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => {
                            removeRace(index);
                            setOpenRaceId(null);
                          }}
                        >
                          {t("prefs.sections.goalSection.removeBtn")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}