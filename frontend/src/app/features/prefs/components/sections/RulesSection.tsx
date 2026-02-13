// src/features/prefs/components/RulesSection.tsx
"use client";

import { useMemo } from "react";

import Button from "@/app/shared/ui/components/Button";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import type { Preferences } from "@/app/features/prefs/types/prefs";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Props = {
  pref: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

type RuleKey = "avoid_back_to_back_hard" | "use_zones";

const BASE_RULES_KEYS: RuleKey[] = ["avoid_back_to_back_hard", "use_zones"];

function normalizePrefs(p: any): Preferences {
  const incoming = p && typeof p === "object" ? p : {};
  const two = incoming.two_a_day;
  const enabled = !!(two && typeof two === "object" ? two.enabled : false);
  const maxRaw = two && typeof two === "object" ? Number(two.max_days_per_week) : 0;
  const max = Number.isFinite(maxRaw) ? Math.max(0, Math.min(2, maxRaw)) : 0;

  return {
    days_off: Array.isArray(incoming.days_off) ? incoming.days_off : [],
    long_run_days: Array.isArray(incoming.long_run_days) ? incoming.long_run_days : [],
    avoid_back_to_back_hard: typeof incoming.avoid_back_to_back_hard === "boolean" ? incoming.avoid_back_to_back_hard : true,
    use_zones: typeof incoming.use_zones === "boolean" ? incoming.use_zones : true,
    two_a_day: { enabled, max_days_per_week: max },
    intensity_model: incoming.intensity_model === "pyramidal" ? "pyramidal" : "polarized",
    training_blocks: incoming.training_blocks && typeof incoming.training_blocks === "object"
      ? { vo2max: !!incoming.training_blocks.vo2max, ftp: !!incoming.training_blocks.ftp, threshold: !!incoming.training_blocks.threshold }
      : { vo2max: false, ftp: false, threshold: false },
  } as Preferences;
}

export function RulesSection({ pref, setLocal, markDirty }: Props) {
  const t = useT();
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
            max_days_per_week: nextEnabled ? Math.max(1, Math.min(2, cur.two_a_day.max_days_per_week || 2)) : 0,
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
          two_a_day: { enabled: cur.two_a_day.enabled, max_days_per_week: clamped },
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
      const nextBlocks = { ...(cur.training_blocks ?? {}), [key]: !(cur.training_blocks as any)?.[key] };
      return { ...prev, preferences: { ...cur, training_blocks: nextBlocks } };
    });
  };

  const enabledShort = BASE_RULES_KEYS.filter((k) => !!(basePref as any)[k]).map(
    (k) => t(`prefs.sections.rulesSection.rules.${k}.short`),
  );
  const twoEnabled = !!basePref.two_a_day?.enabled;
  const twoMax = Number(basePref.two_a_day?.max_days_per_week) || 0;
  const model = basePref.intensity_model ?? "polarized";
  const blocks = basePref.training_blocks ?? {};

  const previewText = [
    enabledShort.length ? enabledShort.join(", ") : t("common.none"),
    `${t("prefs.sections.rulesSection.previewModel")}: ${model}`,
    twoEnabled ? `${t("prefs.sections.rulesSection.previewTwoADay")}: ${twoMax}/${t("common.units.weeksAbbrev")}` : `${t("prefs.sections.rulesSection.previewTwoADay")}: ${t("common.disabled")}`,
    [
      blocks.vo2max ? "VO₂" : null,
      blocks.ftp ? "FTP" : null,
      blocks.threshold ? "THR" : null,
    ].filter(Boolean).join(" · ") || `${t("prefs.sections.rulesSection.previewBlocks")}: —`,
  ].join(" | ");

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.rulesSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.rulesSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.rulesSection.subtitle")}
      preview={previewText}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="flex flex-wrap gap-2">
          {BASE_RULES_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant="prefs"
              active={!!(basePref as any)[key]}
              title={t(`prefs.sections.rulesSection.rules.${key}.label`)}
              onClick={() => toggleRule(key)}
            >
              {t(`prefs.sections.rulesSection.rules.${key}.short`)}
            </Button>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="text-xs opacity-80">{t("prefs.sections.rulesSection.twoADayLabel")}</div>
            <Button
              type="button"
              size="sm"
              variant="prefs"
              active={twoEnabled}
              onClick={toggleTwoADay}
            >
              {twoEnabled ? t("common.enabled") : t("common.disabled")}
            </Button>
          </div>

          {twoEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <div className="text-[11px] opacity-70">{t("prefs.sections.rulesSection.maxDaysLabel")}</div>
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

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <span>{t("prefs.sections.rulesSection.intensityLabel")}</span>
              <TooltipIcon text={t("prefs.sections.rulesSection.intensityTooltip")} />
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
              {t("prefs.sections.rulesSection.enums.polarized")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={model === "pyramidal"}
              onClick={() => setIntensityModel("pyramidal")}
            >
              {t("prefs.sections.rulesSection.enums.pyramidal")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs opacity-80">
              <span>{t("prefs.sections.rulesSection.blocksLabel")}</span>
              <TooltipIcon text={t("prefs.sections.rulesSection.blocksTooltip")} />
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
              {t("prefs.sections.rulesSection.enums.vo2max")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!blocks.ftp}
              onClick={() => toggleBlock("ftp")}
            >
              {t("prefs.sections.rulesSection.enums.ftp")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="prefs"
              active={!!blocks.threshold}
              onClick={() => toggleBlock("threshold")}
            >
              {t("prefs.sections.rulesSection.enums.threshold")}
            </Button>
          </div>
        </div>
      </div>
    </InputsCard>
  );
}