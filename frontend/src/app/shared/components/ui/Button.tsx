// src/app/shared/components/ui/Button.tsx
"use client";

import * as React from "react";
import {
  buttonClass,
  type ButtonVariant,
  type ButtonSize,
  cx,
} from "@/app/shared/ui";
import { BUTTON_BLOCK, BUTTON_DISABLED } from "@/app/shared/ui/tokens";

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
  ...rest
}: Props) {
  const text = typeof children === "string" ? children.trim() : "";
  const autoCircle =
    circle ?? (!!children && text.length > 0 ? text.length <= 2 : !children);
  const useCircle = variant === "prefs" ? false : autoCircle;

  const cls = cx(
    buttonClass(variant, size, { circle: useCircle, active }),
    block && BUTTON_BLOCK,
    disabled && BUTTON_DISABLED,
    className
  );

  return (
    <button className={cls} disabled={disabled} {...rest}>
      {leftIcon && !useCircle && <span className="inline-flex">{leftIcon}</span>}
      {!useCircle && children}
      {rightIcon && !useCircle && (
        <span className="inline-flex">{rightIcon}</span>
      )}
      {useCircle && (leftIcon || rightIcon || children)}
    </button>
  );
}