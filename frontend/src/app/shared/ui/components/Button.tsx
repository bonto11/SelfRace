"use client";

// src/app/shared/ui/components/Button.tsx

import * as React from "react";
import {
  type ButtonVariant,
  type ButtonSize,
  cx,
} from "@/app/shared/ui/utils/inputs";

import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";

// ✅ berieme NOVÉ button tokeny z inputs.ts (lebo si ich tam presunul)
import {
  BUTTON_BASE,
  buttonSizeClass,
  buttonVariantStyle,
} from "@/app/shared/ui/tokens/inputs";

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
  const isStravaConnect = variant === "connectStrava";

  const text = typeof children === "string" ? children.trim() : "";
  const autoCircle =
    circle ?? (!!children && text.length > 0 ? text.length <= 2 : !children);
  const useCircle = variant === "prefs" ? false : autoCircle;

  // connectStrava nech je presne podľa SVG (bez paddingu)
  const sizeCls = isStravaConnect ? "p-0" : buttonSizeClass(size, useCircle);

  const cls = cx(
    BUTTON_BASE,
    sizeCls,
    block && "w-full",
    className,
  );

  const mergedStyle: React.CSSProperties = {
    ...(buttonVariantStyle(variant, { active }) as React.CSSProperties),
    ...(style as React.CSSProperties),
  };

  if (isStravaConnect) {
    return (
      <button className={cls} disabled={disabled} style={mergedStyle} {...rest}>
        <img
          src={STRAVA_ASSETS.connectSvg_orange}
          alt="Connect with Strava"
          style={{ height: 48, width: "auto", display: "block" }}
          draggable={false}
        />
      </button>
    );
  }

  return (
    <button className={cls} disabled={disabled} style={mergedStyle} {...rest}>
      {leftIcon && !useCircle && <span className="inline-flex">{leftIcon}</span>}
      {!useCircle && children}
      {rightIcon && !useCircle && <span className="inline-flex">{rightIcon}</span>}
      {useCircle && (leftIcon || rightIcon || children)}
    </button>
  );
}