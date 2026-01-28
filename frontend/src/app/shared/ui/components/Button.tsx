"use client";

// src/app/shared/components/ui/Button.tsx

import * as React from "react";
import {
  buttonClass,
  type ButtonVariant,
  type ButtonSize,
  cx,
} from "@/app/shared/ui/utils/inputs";
import { BUTTON_BLOCK, BUTTON_DISABLED } from "@/app/shared/ui/tokens";
import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import { appColors } from "@/app/shared/ui/theme/app_colors"; // ✅ NEW

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  circle?: boolean;
  active?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  leftIcon,
  rightIcon,
  circle,
  active = false,
  className,
  children,
  disabled,
  style,
  ...rest
}: Props) {
  // ---- Special variants (Strava) ----
  const isStravaConnect = variant === "connectStrava";
  const isStravaDisconnect = variant === "disconnectStrava";
  const isViewOnStrava = variant === "viewOnStrava"; // ✅ NEW

  // Strava connect button má byť presne podľa SVG (48px height @1x)
  // -> ignoruj children a renderuj image.
  if (isStravaConnect) {
    const cls = cx(
      buttonClass(variant, size, { circle: false, active }),
      block && BUTTON_BLOCK,
      disabled && BUTTON_DISABLED,
      className,
    );

    return (
      <button className={cls} disabled={disabled} {...rest}>
        <img
          src={STRAVA_ASSETS.connectSvg_orange}
          alt="Connect with Strava"
          // presný guideline: height 48px @1x
          style={{ height: 48, width: "auto", display: "block" }}
          draggable={false}
        />
      </button>
    );
  }

  // ---- Default button rendering ----
  const text = typeof children === "string" ? children.trim() : "";
  const autoCircle =
    circle ?? (!!children && text.length > 0 ? text.length <= 2 : !children);
  const useCircle = variant === "prefs" ? false : autoCircle;

  const cls = cx(
    buttonClass(variant, size, { circle: useCircle, active }),
    block && BUTTON_BLOCK,
    disabled && BUTTON_DISABLED,
    className,
  );

  // ✅ viewOnStrava: background z appColors (žiadne CSS vars v komponentoch)
  const mergedStyle: React.CSSProperties | undefined = isViewOnStrava
    ? { background: appColors.backgroundStrava, ...style }
    : style;

  return (
    <button className={cls} disabled={disabled} style={mergedStyle} {...rest}>
      {leftIcon && !useCircle && (
        <span className="inline-flex">{leftIcon}</span>
      )}
      {!useCircle && children}
      {rightIcon && !useCircle && (
        <span className="inline-flex">{rightIcon}</span>
      )}
      {useCircle && (leftIcon || rightIcon || children)}
    </button>
  );
}
