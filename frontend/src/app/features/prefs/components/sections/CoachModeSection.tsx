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
  /** Beží aktívny plán? Od toho závisí potvrdenie a zámok prepnutia späť. */
  hasActivePlan?: boolean;
  /** Režim uložený v DB. */
  savedMode: CoachMode;
  /**
   * Prepnutie sa ukladá OKAMŽITE (nie cez "Uložiť zmeny"). Backend čerstvo
   * vygenerovaný plán posudzuje podľa uloženého režimu, takže neuložený
   * režim by sa pri generovaní správal ako ten starý.
   */
  onChange: (next: CoachMode) => Promise<void>;
  busy?: boolean;
  /** Voľba Živý tréner je pre usera zapnutá (BE TRAINER_USERS). */
  trainerAvailable?: boolean;
  /** Atlét má aktívneho živého trénera – AI režimy sú zamknuté. */
  trainerActive?: boolean;
  /** Je otvorená sekcia živého trénera (výber bez uloženia). */
  trainerOpen?: boolean;
  onTrainerOpenChange?: (open: boolean) => void;
};

/** "trainer" sa neukladá do coach_mode – plyne z aktívneho trainer_links
 *  (BE drží coach_mode = advisor, takže všetky AI gates platia bez zmeny). */
type ModeOption = CoachMode | "trainer";

export function CoachModeSection({
  local,
  hasActivePlan = false,
  savedMode,
  onChange,
  busy = false,
  trainerAvailable = false,
  trainerActive = false,
  trainerOpen = false,
  onTrainerOpenChange,
}: Props) {
  const t = useT();
  const mode: CoachMode = local.coach_mode ?? savedMode;
  const shownMode: ModeOption = trainerActive || trainerOpen ? "trainer" : mode;

  // Poradca -> Coach pri bežiacom pláne nejde: advisor plán nemá weekly
  // riadky, takže by coach nemal z čoho stavať.
  const coachLocked = hasActivePlan && savedMode === "advisor";

  const handleSelect = useCallback(
    async (opt: ModeOption) => {
      if (busy || trainerActive) return;
      if (opt === "trainer") {
        onTrainerOpenChange?.(true);
        return;
      }
      const next: CoachMode = opt;
      if (trainerOpen) onTrainerOpenChange?.(false);
      if (next === mode) return;
      if (next === "coach" && coachLocked) return;

      // Coach -> Poradca pri bežiacom pláne je jednosmerné - pýtame si
      // potvrdenie. Späť sa dá až po ukončení plánu.
      if (next === "advisor" && hasActivePlan) {
        const ok = await confirm({
          title: t("prefs.coachMode.switchConfirmTitle" as any),
          message: t("prefs.coachMode.switchConfirmMessage" as any),
          okText: t("prefs.coachMode.switchConfirmOk" as any),
          cancelText: t("common.cancel"),
          tone: "danger",
        });
        if (!ok) return;
      }

      await onChange(next);
    },
    [busy, trainerActive, trainerOpen, onTrainerOpenChange, mode, coachLocked, hasActivePlan, onChange, t],
  );

  const allOptions: { value: ModeOption; label: string; desc: string }[] = [
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
    {
      value: "trainer",
      label: t("prefs.coachMode.trainerLabel"),
      desc: t("prefs.coachMode.trainerDesc"),
    },
  ];
  const options = allOptions.filter((o) => o.value !== "trainer" || trainerAvailable);

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
          const active = shownMode === opt.value;
          const locked =
            !active &&
            ((opt.value === "coach" && coachLocked) || (trainerActive && opt.value !== "trainer"));
          const disabled = locked || busy;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              onClick={() => handleSelect(opt.value)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: locked ? 0.4 : busy && !active ? 0.6 : 1,
                background: active ? appColors.buttonPrimaryBg : "transparent",
                color: active ? appColors.buttonPrimaryText : appColors.textSecondary,
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
        {options.find((o) => o.value === shownMode)?.desc}
      </div>

      {trainerActive && (
        <div
          style={{
            fontSize: 12,
            marginTop: 10,
            lineHeight: 1.4,
            color: appColors.textSecondary,
            opacity: 0.85,
          }}
        >
          {t("prefs.coachMode.trainerLocked")}
        </div>
      )}

      {coachLocked && !trainerActive && !trainerOpen && (
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
    </div>
  );
}
