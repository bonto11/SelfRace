// src/app/features/prefs/components/sections/CoachModeSection.tsx
"use client";

import { useEffect, useRef } from "react";
import type { CoachMode, CoachPrefs } from "@/app/features/prefs/types/prefs";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_ACTIONS_INLINE } from "@/app/shared/ui/tokens/panels";

type Props = {
  local: CoachPrefs;
  setPref: <K extends keyof CoachPrefs>(key: K, val: CoachPrefs[K]) => void;
  /** 🌟 NOVÉ: pri aktívnom pláne upozorní, že zmena režimu plán nemení */
  hasActivePlan?: boolean;
};

export function CoachModeSection({ local, setPref, hasActivePlan = false }: Props) {
  const t = useT();
  const mode: CoachMode = local.coach_mode ?? "coach";

  // Režim, s ktorým sa prefs načítali (prvá definovaná hodnota) - hint sa
  // zobrazí len keď ho user reálne zmenil.
  const loadedModeRef = useRef<CoachMode | null>(null);
  useEffect(() => {
    if (loadedModeRef.current === null && local.coach_mode) {
      loadedModeRef.current = local.coach_mode;
    }
  }, [local.coach_mode]);

  const modeChanged = loadedModeRef.current !== null && loadedModeRef.current !== mode;

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
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPref("coach_mode", opt.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
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