// src/app/features/prefs/components/sections/CoachModeSection.tsx
"use client";

import { useCallback } from "react";
import type { CoachMode, CoachPrefs } from "@/app/features/prefs/types/prefs";
import { useT } from "@/app/shared/i18n/useT";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_ACTIONS_INLINE } from "@/app/shared/ui/tokens/panels";

type Props = {
  local: CoachPrefs;
  setPref: <K extends keyof CoachPrefs>(key: K, val: CoachPrefs[K]) => void;
  /** Beží aktívny plán? Od toho závisí potvrdenie a zámok prepnutia späť. */
  hasActivePlan?: boolean;
  /** Režim, ktorý je reálne uložený v DB (nie rozpracovaná zmena v UI). */
  savedMode: CoachMode;
};

export function CoachModeSection({
  local,
  setPref,
  hasActivePlan = false,
  savedMode,
}: Props) {
  const t = useT();
  const mode: CoachMode = local.coach_mode ?? "coach";

  const modeChanged = mode !== savedMode;

  // Poradca -> Coach pri bežiacom pláne nejde: advisor plán nemá weekly
  // riadky, takže by coach nemal z čoho stavať. Zámok sa riadi ULOŽENÝM
  // režimom - kto len v UI prepol na poradcu a ešte neuložil, sa môže
  // vrátnuť.
  const coachLocked = hasActivePlan && savedMode === "advisor";

  const handleSelect = useCallback(
    async (next: CoachMode) => {
      if (next === mode) return;
      if (next === "coach" && coachLocked) return;

      // Coach -> Poradca pri bežiacom pláne je jednosmerné - pýtame si
      // potvrdenie. Weekly plán ostane nevyužitý a späť sa dá až po
      // ukončení plánu.
      if (next === "advisor" && savedMode === "coach" && hasActivePlan) {
        const ok = await confirm({
          title: t("prefs.coachMode.switchConfirmTitle" as any),
          message: t("prefs.coachMode.switchConfirmMessage" as any),
          okText: t("prefs.coachMode.switchConfirmOk" as any),
          cancelText: t("common.cancel"),
          tone: "danger",
        });
        if (!ok) return;
      }

      setPref("coach_mode", next);
    },
    [mode, coachLocked, savedMode, hasActivePlan, setPref, t],
  );

  const options: { value: CoachMode; label: string; desc: string }[] = [
    {
      value: "coach",
      label: t("prefs.coachMode.coachLabel"),
      desc: t("prefs.coachMode.coachDesc"),
    },
    {
      value: "advisor",
      label: t("prefs.coachMode.advisorLabel"),
      desc: t("prefs.coachMode.advisorDesc"),
    },
  ];

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${appColors.surfaceCardBorder}`,
        background: appColors.surfaceCard,
        marginBottom: 4,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: appColors.textPrimary,
          marginBottom: 10,
        }}
      >
        {t("prefs.coachMode.title")}
      </div>

      <div
        className={PANEL_ACTIONS_INLINE}
        style={{
          display: "flex",
          gap: 8,
          padding: 3,
          borderRadius: 10,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          background: appColors.surfaceSolid,
        }}
      >
        {options.map((opt) => {
          const active = mode === opt.value;
          const locked = opt.value === "coach" && coachLocked && !active;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={locked}
              aria-disabled={locked}
              onClick={() => handleSelect(opt.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.4 : 1,
                background: active ? appColors.buttonMainBg : "transparent",
                color: active ? appColors.buttonMainText : appColors.textSecondary,
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.75,
          color: appColors.textSecondary,
          marginTop: 10,
          lineHeight: 1.4,
        }}
      >
        {options.find((o) => o.value === mode)?.desc}
      </div>

      {coachLocked && (
        <div
          style={{
            fontSize: 12,
            marginTop: 10,
            lineHeight: 1.4,
            color: appColors.textSecondary,
            opacity: 0.85,
          }}
        >
          {t("prefs.coachMode.cannotSwitchBack" as any)}
        </div>
      )}

      {hasActivePlan && modeChanged && (
        <div
          style={{
            fontSize: 12,
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 8,
            lineHeight: 1.4,
            color: appColors.statusWarning,
            border: `1px solid ${appColors.statusWarning}55`,
            background: `${appColors.statusWarning}14`,
          }}
        >
          {t("prefs.coachMode.activePlanHint")}
        </div>
      )}
    </div>
  );
}
