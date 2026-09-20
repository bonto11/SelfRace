"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

const GEAR_OPTIONS = [
  "dumbbells", "barbell", "kettlebell", "trx", "pullup_bar",
  "resistance_bands", "bench", "medicine_ball", "sandbag", "box", "abwheel"
] as const;

// 🌟 Cieľ silového tréningu - riadi série, opakovania aj pauzy
// (Services/strength/schemes.py). Poradie od najľahšieho po najťažší.
const GOAL_OPTIONS = [
  "general_resilience",
  "strength_endurance",
  "hypertrophy",
  "max_strength",
  "power",
] as const;

// 🌟 Skúsenosť v posilňovni (nie v hlavnom športe) - riadi počet sérií,
// technickú náročnosť povolených cvikov a vzdialenosť od zlyhania.
const LEVEL_OPTIONS = ["beginner", "intermediate", "advanced"] as const;

// 🌟 Referenčné maximá pre % based programovanie a odhad váh.
const REFERENCE_LIFTS = ["squat_kg", "deadlift_kg", "bench_kg", "ohp_kg"] as const;

const DURATION_STEP = 15;
const DURATION_MIN = 30;
const DURATION_MAX = 90;
const DURATION_DEFAULT = 60;

const GOAL_DEFAULT = "general_resilience";
const LEVEL_DEFAULT = "intermediate";

export function StrengthSection({ local, setLocal, markDirty }: Props) {
  const t = useT();
  const settings = local.strength_settings ?? {};
  const lang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const location: string | null = settings.location ?? null;
  const mode: string | null = settings.equipment_mode ?? null;
  const available: string[] = Array.isArray(settings.available) ? settings.available : [];
  const sessionsPerWeek: number | null = settings.sessions_per_week != null ? Number(settings.sessions_per_week) : null;
  const sessionDurationMin: number = settings.session_duration_min != null ? Number(settings.session_duration_min) : DURATION_DEFAULT;

  // 🌟 NOVÉ
  const goal: string = settings.goal ?? GOAL_DEFAULT;
  const level: string = settings.experience_level ?? LEVEL_DEFAULT;
  const disliked: string[] = Array.isArray(settings.disliked_exercises) ? settings.disliked_exercises : [];
  const refLifts: Record<string, number | null> = settings.reference_lifts ?? {};

  const [dislikeQuery, setDislikeQuery] = useState("");
  const [dislikePickerOpen, setDislikePickerOpen] = useState(false);

  const previewText = useMemo(() => {
    const locText = location ? (t as any)(`prefs.sections.strengthSection.locations.${location}`) : "—";
    const modeText = mode ? (t as any)(`prefs.sections.strengthSection.modes.${mode}`) : "—";
    const goalText = (t as any)(`prefs.sections.strengthSection.goals.${goal}`);
    const spw = sessionsPerWeek ?? "—";
    const gearCount = available.length;

    const listShort = gearCount === 0
      ? t("common.none")
      : gearCount <= 3
        ? available.map(k => (t as any)(`prefs.sections.strengthSection.gear.${k}`)).join(", ")
        : `${available.slice(0, 3).map(k => (t as any)(`prefs.sections.strengthSection.gear.${k}`)).join(", ")} +${gearCount - 3} ${t("common.more")}`;

    return `${t("prefs.sections.strengthSection.previewGoal")}: ${goalText} • ${t("prefs.sections.strengthSection.previewSessions")}: ${spw} • ${t("prefs.sections.strengthSection.previewDuration")}: ${sessionDurationMin} ${t("common.units.min")} • ${t("prefs.sections.strengthSection.previewLocation")}: ${locText} • ${t("prefs.sections.strengthSection.previewMode")}: ${modeText} | ${t("prefs.sections.strengthSection.previewGear")} (${gearCount}): ${listShort}`;
  }, [location, mode, available, sessionsPerWeek, sessionDurationMin, goal, t]);

  /* ---- settery ---- */

  const patchSettings = (patch: Record<string, any>) => {
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: { ...(p.strength_settings ?? {}), ...patch },
    }));
  };

  const setSessionsPerWeek = (next: number | null) =>
    patchSettings({ sessions_per_week: next });

  const setSessionDurationMin = (next: number) =>
    patchSettings({
      session_duration_min: Math.max(DURATION_MIN, Math.min(DURATION_MAX, next)),
    });

  const setLocation = (next: string | null) => patchSettings({ location: next });
  const setMode = (next: string | null) => patchSettings({ equipment_mode: next });
  const setGoal = (next: string) => patchSettings({ goal: next });
  const setLevel = (next: string) => patchSettings({ experience_level: next });

  const toggleGear = (key: string) => {
    const next = available.includes(key)
      ? available.filter((k) => k !== key)
      : [...available, key];
    patchSettings({ available: next });
  };

  const setRefLift = (key: string, value: string) => {
    const num = value === "" ? null : Number(value);
    patchSettings({
      reference_lifts: {
        ...refLifts,
        [key]: num != null && Number.isFinite(num) && num > 0 ? num : null,
      },
    });
  };

  const addDisliked = (exerciseId: string) => {
    if (disliked.includes(exerciseId)) return;
    patchSettings({ disliked_exercises: [...disliked, exerciseId] });
    setDislikeQuery("");
    setDislikePickerOpen(false);
  };

  const removeDisliked = (exerciseId: string) => {
    patchSettings({
      disliked_exercises: disliked.filter((id) => id !== exerciseId),
    });
  };

  const dislikeOptions = useMemo(() => {
    const q = dislikeQuery.trim().toLowerCase();
    return Object.entries(STRENGTH_CATALOG_FE)
      .map(([id, names]) => ({ id, name: (names as any)[lang] as string }))
      .filter((o) => !disliked.includes(o.id))
      .filter((o) => !q || o.name.toLowerCase().includes(q) || o.id.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 30);
  }, [dislikeQuery, disliked, lang]);

  const resolveName = (id: string) =>
    STRENGTH_CATALOG_FE[id]?.[lang] ?? id.replace(/_/g, " ");

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.strengthSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.strengthSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.strengthSection.subtitle")}
      preview={previewText}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* 🌟 NOVÉ: cieľ silového tréningu - najdôležitejšie nastavenie,
            ide úplne hore, lebo riadi všetko ostatné */}
        <div>
          <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
            <span>{t("prefs.sections.strengthSection.goalLabel")}</span>
            <TooltipIcon text={t("prefs.sections.strengthSection.goalTooltip")} />
          </div>
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => (
              <Button
                key={g}
                type="button"
                size="sm"
                variant="prefs"
                active={goal === g}
                onClick={() => setGoal(g)}
              >
                {(t as any)(`prefs.sections.strengthSection.goals.${g}`)}
              </Button>
            ))}
          </div>
          <div className="text-[11px] opacity-60 mt-1.5 leading-relaxed">
            {(t as any)(`prefs.sections.strengthSection.goalHints.${goal}`)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.sessionsLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.sessionsTooltip")} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionsPerWeek(Math.max(0, (sessionsPerWeek ?? 2) - 1))} title={t("prefs.sections.strengthSection.btnDecrease")}>−</Button>
              <div className="min-w-[42px] text-center text-sm font-semibold">{sessionsPerWeek ?? 2}</div>
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionsPerWeek(Math.min(7, (sessionsPerWeek ?? 2) + 1))} title={t("prefs.sections.strengthSection.btnIncrease")}>+</Button>
              <Button type="button" size="sm" variant="prefs" active={sessionsPerWeek == null} onClick={() => setSessionsPerWeek(null)} title={t("prefs.sections.strengthSection.btnUnset")}>—</Button>
            </div>
            <div className="text-[11px] opacity-60 mt-1">{t("prefs.sections.strengthSection.currentLabel")}: {sessionsPerWeek ?? 2}</div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.durationLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.durationTooltip")} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionDurationMin(sessionDurationMin - DURATION_STEP)} disabled={sessionDurationMin <= DURATION_MIN} title={t("prefs.sections.strengthSection.btnDecrease")}>−</Button>
              <div className="min-w-[56px] text-center text-sm font-semibold">{sessionDurationMin} {t("common.units.min")}</div>
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionDurationMin(sessionDurationMin + DURATION_STEP)} disabled={sessionDurationMin >= DURATION_MAX} title={t("prefs.sections.strengthSection.btnIncrease")}>+</Button>
            </div>
            <div className="text-[11px] opacity-60 mt-1">{t("prefs.sections.strengthSection.durationHint")}</div>
          </div>

          {/* 🌟 NOVÉ: skúsenosť v posilke */}
          <div>
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.levelLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.levelTooltip")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((l) => (
                <Button
                  key={l}
                  type="button"
                  size="sm"
                  variant="prefs"
                  active={level === l}
                  onClick={() => setLevel(l)}
                >
                  {(t as any)(`prefs.sections.strengthSection.levels.${l}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">{t("prefs.sections.strengthSection.locationLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {["gym", "home", "outdoor"].map((loc) => (
                <Button key={loc} type="button" size="sm" variant="prefs" active={location === loc} onClick={() => setLocation(location === loc ? null : loc)}>
                  {(t as any)(`prefs.sections.strengthSection.locations.${loc}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">{t("prefs.sections.strengthSection.modeLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {["none", "bodyweight", "minimal", "full_gym"].map((m) => (
                <Button key={m} type="button" size="sm" variant="prefs" active={mode === m} onClick={() => setMode(mode === m ? null : m)}>
                  {(t as any)(`prefs.sections.strengthSection.modes.${m}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.gearLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.gearTooltip")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {GEAR_OPTIONS.map((key) => (
                <Button key={key} type="button" size="xs" variant="prefs" active={available.includes(key)} onClick={() => toggleGear(key)} className="text-xs">
                  {(t as any)(`prefs.sections.strengthSection.gear.${key}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* 🌟 NOVÉ: referenčné maximá (1RM) */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.refLiftsLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.refLiftsTooltip")} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {REFERENCE_LIFTS.map((key) => (
                <div key={key}>
                  <div className="text-[11px] opacity-60 mb-1">
                    {(t as any)(`prefs.sections.strengthSection.refLifts.${key}`)}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="2.5"
                      min="0"
                      className="w-full rounded bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-white text-center focus:border-white/30 focus:outline-none placeholder:text-white/20"
                      placeholder="—"
                      value={refLifts[key] ?? ""}
                      onChange={(e) => setRefLift(key, e.target.value)}
                    />
                    <span className="text-[11px] opacity-50">kg</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11px] opacity-60 mt-1.5">
              {t("prefs.sections.strengthSection.refLiftsHint")}
            </div>
          </div>

          {/* 🌟 NOVÉ: nechcené cviky */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.dislikedLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.dislikedTooltip")} />
            </div>

            {disliked.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {disliked.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => removeDisliked(id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs capitalize transition-colors hover:bg-white/10"
                    style={{
                      borderColor: `${appColors.statusError}55`,
                      color: appColors.textPrimary,
                    }}
                    title={t("common.delete")}
                  >
                    {resolveName(id)}
                    <span style={{ color: appColors.statusError }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {dislikePickerOpen ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
                <input
                  autoFocus
                  className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none placeholder:text-white/20"
                  placeholder={t("prefs.sections.strengthSection.dislikedSearch")}
                  value={dislikeQuery}
                  onChange={(e) => setDislikeQuery(e.target.value)}
                />
                <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1">
                  {dislikeOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => addDisliked(o.id)}
                      className="text-left text-sm px-3 py-2 rounded hover:bg-white/10 transition-colors capitalize"
                    >
                      {o.name}
                    </button>
                  ))}
                  {dislikeOptions.length === 0 && (
                    <div className="text-xs opacity-40 px-3 py-2">
                      {t("prefs.sections.strengthSection.dislikedNoMatch")}
                    </div>
                  )}
                </div>
                <Button size="xs" variant="secondary" onClick={() => setDislikePickerOpen(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="prefs"
                onClick={() => setDislikePickerOpen(true)}
              >
                + {t("prefs.sections.strengthSection.dislikedAdd")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}
