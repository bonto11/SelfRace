// src/app/features/coach/components/RaceCountdownDetail.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref, apiUpsertUserPref } from "@/app/features/prefs/api/prefs";
import { normalizeCoachPrefs } from "@/app/features/prefs/utils/prefs";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectField from "@/app/shared/ui/components/SelectField";
import DateField from "@/app/shared/ui/components/DateField";
import NumberField from "@/app/shared/ui/components/NumberField";
import TimeField from "@/app/shared/ui/components/TimeField";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const PRIORITIES   = ["A", "B", "C"] as const;
const RACE_GOALS   = ["5k", "10k", "half", "marathon", "ultra", "other"] as const;
const RACE_TYPES   = ["road", "trail", "track", "cross", "hyrox", "ocr", "other"] as const;
const TERRAIN      = ["flat", "rolling", "hilly", "mountain"] as const;
const ELEVATION    = ["low", "moderate", "high"] as const;

function makeId() {
  return `race_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function emptyRace() {
  return {
    id: makeId(), name: "", date: null, priority: null,
    race_goal: null, custom_distance_km: null, target_time: null,
    race_type: null, terrain: null, elevation_profile: null, elevation_gain_m: null,
  };
}
function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const race  = new Date(dateStr); race.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/* ─── RACE CARD — rovnaká štruktúra ako GoalSection ─── */
function RaceCard({ race, index, onChange, onRemove, t }: {
  race: any; index: number;
  onChange: (patch: any) => void;
  onRemove: () => void;
  t: any;
}) {
  const days = race.date ? daysUntil(race.date) : null;
  const raceGoal = race.race_goal as typeof RACE_GOALS[number] | null;
  const showCustom = raceGoal === "other" || raceGoal === "ultra";

  const getRaceGoalLabel = (rg: string) =>
    (t as any)(`prefs.sections.goalSection.enums.race.${rg}`) || rg;
  const getRaceTypeLabel = (rt: string) =>
    (t as any)(`prefs.sections.goalSection.enums.type.${rt}`) || rt;
  const getTerrainLabel = (tr: string) =>
    (t as any)(`prefs.sections.goalSection.enums.terrain.${tr}`) || tr;
  const getElevationLabel = (el: string) =>
    (t as any)(`prefs.sections.goalSection.enums.elevation.${el}`) || el;

  return (
    <div className="rounded-xl border border-white/10 px-3 py-3 space-y-3 bg-black/10">
      {/* Meno + dni + remove */}
      <div className="flex items-start justify-between gap-2">
        <TextField
          containerClassName="flex-1"
          label={t("prefs.sections.goalSection.raceNameLabel").replace("{{index}}", String(index + 1))}
          placeholder={t("prefs.sections.goalSection.raceNamePlaceholder")}
          value={race.name ?? ""}
          onChange={(e) => onChange({ name: e.currentTarget.value || null })}
        />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {days !== null && (
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: days <= 7 ? appColors.stateDanger : days <= 21 ? appColors.stateWarning : "#4ade80",
            }}>
              {days} {t("common.units.days") as string}
            </span>
          )}
          <Button size="xs" variant="danger" onClick={onRemove}>
            {t("prefs.sections.goalSection.removeBtn")}
          </Button>
        </div>
      </div>

      {/* Grid 4: dátum, priorita, cieľový čas, prevýšenie */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-xs opacity-70 mb-1">
            {t("prefs.sections.goalSection.dateLabel")}
          </div>
          <DateField
            value={race.date ?? null}
            onChange={(v) => onChange({ date: v || null })}
            variant="editable"
          />
        </div>

        <SelectField
          label={t("prefs.sections.goalSection.priorityLabel")}
          value={race.priority ?? ""}
          onChange={(e) => onChange({ priority: e.currentTarget.value || null })}
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
            hh mm ss
            value={race.target_time ?? ""}
            onChange={(v) => onChange({ target_time: v || null })}
          />
        </div>

        <div>
          <div className="text-xs opacity-70 mb-1">
            {t("prefs.sections.goalSection.elevationGainLabel")}
          </div>
          <NumberField
            min={0} max={10000} step={50}
            unit={t("common.units.meter")}
            value={race.elevation_gain_m ?? ""}
            onChange={(val) => onChange({ elevation_gain_m: val === "" ? null : val })}
          />
        </div>
      </div>

      {/* Trasa a terén */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs opacity-70">
          <span>{t("prefs.sections.goalSection.distTerrainTitle")}</span>
          <TooltipIcon text={t("prefs.sections.goalSection.distTerrainTooltip")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Vzdialenosť — tlačidlá */}
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
                  onClick={() => {
                    const next = raceGoal === rg ? null : rg;
                    const patch: any = { race_goal: next };
                    if (next !== "other" && next !== "ultra") patch.custom_distance_km = null;
                    onChange(patch);
                  }}
                >
                  {getRaceGoalLabel(rg)}
                </Button>
              ))}
            </div>
            {showCustom && (
              <div className="mt-2">
                <NumberField
                  label={t("prefs.sections.goalSection.customDistLabel")}
                  min={1} max={300} step={1}
                  unit={t("common.units.km")}
                  value={race.custom_distance_km ?? ""}
                  onChange={(val) => onChange({ custom_distance_km: val === "" ? null : val })}
                />
              </div>
            )}
          </div>

          {/* Typ pretekov */}
          <SelectField
            label={t("prefs.sections.goalSection.raceTypeLabel")}
            value={race.race_type ?? ""}
            onChange={(e) => onChange({ race_type: e.currentTarget.value || null })}
            options={[
              { value: "", label: "—" },
              ...RACE_TYPES.map((rt) => ({ value: rt, label: getRaceTypeLabel(rt) })),
            ]}
          />

          {/* Terén + profil */}
          <div className="space-y-2">
            <SelectField
              label={t("prefs.sections.goalSection.terrainLabel")}
              value={race.terrain ?? ""}
              onChange={(e) => onChange({ terrain: e.currentTarget.value || null })}
              options={[
                { value: "", label: "—" },
                ...TERRAIN.map((tr) => ({ value: tr, label: getTerrainLabel(tr) })),
              ]}
            />
            <SelectField
              label={t("prefs.sections.goalSection.elevationProfileLabel")}
              value={race.elevation_profile ?? ""}
              onChange={(e) => onChange({ elevation_profile: e.currentTarget.value || null })}
              options={[
                { value: "", label: "—" },
                ...ELEVATION.map((el) => ({ value: el, label: getElevationLabel(el) })),
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function RaceCountdownDetail() {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [prefs, setPrefs]     = useState<any>(null);
  const [races, setRaces]     = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const raw = await apiFetchUserPref(userId, "coach.prefs");
        if (!alive) return;
        const normalized = normalizeCoachPrefs(raw);
        setPrefs(normalized);
        setRaces(Array.isArray(normalized?.targets?.run?.races)
          ? normalized.targets.run.races : []);
      } catch (e) {
        console.error("[RaceCountdownDetail] load error", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const updateRaceAt = useCallback((index: number, patch: any) => {
    setRaces((prev) => {
      const next = prev.map((r, i) => i === index ? { ...r, ...patch } : r);
      // Ak sa nastavuje A priorita, odber ostatných A
      if (patch.priority === "A") {
        for (let i = 0; i < next.length; i++) {
          if (i !== index && next[i].priority === "A") next[i] = { ...next[i], priority: null };
        }
      }
      return next;
    });
  }, []);

  const addRace = useCallback(() => {
    setRaces((prev) => {
      const hasA = prev.some((r) => r.priority === "A");
      return [...prev, { ...emptyRace(), priority: hasA ? null : "A" }];
    });
  }, []);

  const removeRace = useCallback((index: number) => {
    setRaces((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const main = races.find((r) => r.priority === "A") ?? races[0];
      const updated = {
        ...prefs,
        targets: {
          ...(prefs?.targets ?? {}),
          run: {
            ...(prefs?.targets?.run ?? {}),
            races,
            ...(main ? {
              race_goal: main.race_goal ?? null,
              custom_distance_km: main.custom_distance_km ?? null,
              target_time: main.target_time ?? null,
              race_type: main.race_type ?? null,
              terrain: main.terrain ?? null,
              elevation_profile: main.elevation_profile ?? null,
            } : {}),
          },
        },
      };
      await apiUpsertUserPref(userId, "coach.prefs", updated);
      setPrefs(updated);
      toast.success(t("common.done"));
    } catch {
      toast.error(t("api.prefs.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <LoadingSpinner size="trend" />
    </div>
  );

  // Zobrazuj zoradené podľa dátumu
  const sorted = [...races].sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return (
    <>
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        <div style={{ padding: "14px 16px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
              {t("prefs.sections.goalSection.racesTitle")}
            </div>
            <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 2 }}>
              {t("prefs.sections.goalSection.subtitle")}
            </div>
          </div>
          <Button size="xs" variant="success" onClick={addRace}>
            {t("prefs.sections.goalSection.addBtn")}
          </Button>
        </div>

        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
          {races.length === 0 ? (
            <p style={{ fontSize: 13, color: appColors.textMuted, padding: "8px 4px" }}>
              {t("prefs.sections.goalSection.noRaces")}
            </p>
          ) : (
            sorted.map((race) => {
              const origIndex = races.findIndex((r) => r.id === race.id);
              return (
                <RaceCard
                  key={race.id ?? origIndex}
                  race={race}
                  index={origIndex}
                  onChange={(patch) => updateRaceAt(origIndex, patch)}
                  onRemove={() => removeRace(origIndex)}
                  t={t}
                />
              );
            })
          )}
        </div>
      </section>

      <div style={{ padding: "12px 0" }}>
        <Button variant="primary" onClick={onSave} disabled={saving} style={{ width: "100%" }}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </>
  );
}