// src/features/prefs/components/RulesSection.tsx
"use client";

import { useMemo } from "react";

import Button from "@/app/shared/ui/components/Button";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import type { Preferences } from "@/app/features/prefs/types/prefs";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

type Props = {
  pref: any; // prefDefaults(local) (recommended) or local.preferences
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

type RuleKey = "avoid_back_to_back_hard" | "use_zones";

const BASE_RULES: Array<{ key: RuleKey; label: string; short: string }> = [
  {
    key: "avoid_back_to_back_hard",
    label: "Avoid two hard days in a row",
    short: "No back-to-back hard",
  },
  { key: "use_zones", label: "Use zones", short: "Use zones" },
];

function normalizePrefs(p: any): Preferences {
  const incoming = p && typeof p === "object" ? p : {};

  const two = incoming.two_a_day;
  const enabled = !!(two && typeof two === "object" ? two.enabled : false);
  const maxRaw =
    two && typeof two === "object" ? Number(two.max_days_per_week) : 0;
  const max = Number.isFinite(maxRaw) ? Math.max(0, Math.min(2, maxRaw)) : 0;

  const intensity_model =
    incoming.intensity_model === "pyramidal" ? "pyramidal" : "polarized";

  const b = incoming.training_blocks;
  const training_blocks =
    b && typeof b === "object"
      ? { vo2max: !!b.vo2max, ftp: !!b.ftp, threshold: !!b.threshold }
      : { vo2max: false, ftp: false, threshold: false };

  return {
    days_off: Array.isArray(incoming.days_off) ? incoming.days_off : [],
    long_run_days: Array.isArray(incoming.long_run_days)
      ? incoming.long_run_days
      : [],
    avoid_back_to_back_hard:
      typeof incoming.avoid_back_to_back_hard === "boolean"
        ? incoming.avoid_back_to_back_hard
        : true,
    use_zones:
      typeof incoming.use_zones === "boolean" ? incoming.use_zones : true,
    two_a_day: { enabled, max_days_per_week: max },
    intensity_model,
    training_blocks,
  } as Preferences;
}

export function RulesSection({ pref, setLocal, markDirty }: Props) {
  const basePref = useMemo(() => normalizePrefs(pref), [pref]);

  const toggleRule = (key: RuleKey) => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      return { ...prev, preferences: { ...cur, [key]: !cur[key] } };
    });
  };

  const toggleTwoADay = () => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      const nextEnabled = !cur.two_a_day.enabled;

      return {
        ...prev,
        preferences: {
          ...cur,
          two_a_day: {
            enabled: nextEnabled,
            max_days_per_week: nextEnabled
              ? Math.max(1, Math.min(2, cur.two_a_day.max_days_per_week || 2))
              : 0,
          },
        },
      };
    });
  };

  const setTwoADayMax = (nextMax: number) => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      const clamped = Math.max(0, Math.min(2, nextMax));
      return {
        ...prev,
        preferences: {
          ...cur,
          two_a_day: {
            enabled: cur.two_a_day.enabled,
            max_days_per_week: clamped,
          },
        },
      };
    });
  };

  const setIntensityModel = (model: "polarized" | "pyramidal") => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      return { ...prev, preferences: { ...cur, intensity_model: model } };
    });
  };

  const toggleBlock = (key: "vo2max" | "ftp" | "threshold") => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      const nextBlocks = {
        ...(cur.training_blocks ?? {}),
        [key]: !(cur.training_blocks as any)?.[key],
      };
      return { ...prev, preferences: { ...cur, training_blocks: nextBlocks } };
    });
  };

  const enabledShort = BASE_RULES.filter((r) => !!(basePref as any)[r.key]).map(
    (r) => r.short,
  );
  const twoEnabled = !!basePref.two_a_day?.enabled;
  const twoMax = Number(basePref.two_a_day?.max_days_per_week) || 0;

  const model = basePref.intensity_model ?? "polarized";
  const blocks = basePref.training_blocks ?? {};

  const previewText = [
    enabledShort.length ? enabledShort.join(", ") : "none",
    `model: ${model}`,
    twoEnabled ? `two-a-day: ${twoMax}/wk` : "two-a-day: off",
    [
      blocks.vo2max ? "VO₂" : null,
      blocks.ftp ? "FTP" : null,
      blocks.threshold ? "THR" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "blocks: —",
  ].join(" | ");

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Rules</span>
          <TooltipIcon text="Rules + intensity + blocks. Všetko je v preferences.* (ukladá sa do coach.prefs)." />
        </div>
      }
      subtitle="Pravidlá plánovania, intenzitný model a tréningové bloky."
      preview={previewText}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Base rules */}
        <div className="flex flex-wrap gap-2">
          {BASE_RULES.map(({ key, label, short }) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="prefs"
              active={!!(basePref as any)[key]}
              title={label}
              onClick={() => toggleRule(key)}
            >
              {short}
            </Button>
          ))}
        </div>

        {/* Two-a-day */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs opacity-80">Two-a-day</div>
            <Button
              type="button"
              size="sm"
              variant="prefs"
              active={twoEnabled}
              onClick={toggleTwoADay}
            >
              {twoEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>

          {twoEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-[11px] opacity-70">Max days/week:</div>
              {[0, 1, 2].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={twoMax === n}
                  onClick={() => setTwoADayMax(n)}
                >
                  {n}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Intensity model */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <span>Intensity model</span>
              <TooltipIcon text="Vyber len 1. Default: Polarized (80/20). Pyramidal = viac času v Z2–Z3." />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={model === "polarized"}
              onClick={() => setIntensityModel("polarized")}
            >
              Polarized (80/20)
            </Button>
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={model === "pyramidal"}
              onClick={() => setIntensityModel("pyramidal")}
            >
              Pyramidal
            </Button>
          </div>
        </div>

        {/* Training blocks */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <span>Training blocks</span>
              <TooltipIcon text="Len flagy v preferences.training_blocks.*" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!blocks.vo2max}
              onClick={() => toggleBlock("vo2max")}
            >
              VO₂max (run)
            </Button>

            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!blocks.ftp}
              onClick={() => toggleBlock("ftp")}
            >
              FTP (ride)
            </Button>

            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!blocks.threshold}
              onClick={() => toggleBlock("threshold")}
            >
              Threshold focus
            </Button>
          </div>
        </div>
      </div>
    </InputsCard>
  );
}