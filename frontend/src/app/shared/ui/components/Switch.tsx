// src/app/shared/ui/components/Switch.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** prístupnosť – switch nemá viditeľný text */
  ariaLabel: string;
};

/**
 * Samostatný prepínač (bez riadku s textom). Toggle.tsx je celý riadok
 * s popisom – tu treba len prepínač do hlavičky karty.
 */
export default function Switch({ checked, onChange, disabled, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative inline-flex items-center h-[24px] w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      style={{
        backgroundColor: checked ? appColors.brandPrimary : appColors.surfaceCardBorder,
      }}
    >
      <span
        className={`inline-block w-[18px] h-[18px] rounded-full shadow transition-transform ${
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
        style={{ backgroundColor: appColors.textPrimary }}
      />
    </button>
  );
}
