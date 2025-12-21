//shared/components/ui/Button
"use client";
import * as React from "react";
import {
  buttonClass,
  type ButtonVariant,
  type ButtonSize,
  cx,
} from "@/app/shared/ui";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** vynútiť kruh (napr. čisto ikonové tlačidlo) */
  circle?: boolean;
  /** pre variant="prefs" – určuje zelený/nezelený stav */
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
  // auto-kruh pre krátky text/ikonu; pre "prefs" nikdy nechceme kruh
  const text = typeof children === "string" ? children.trim() : "";
  const autoCircle =
    circle ?? (!!children && text.length > 0 ? text.length <= 2 : !children);
  const useCircle = variant === "prefs" ? false : autoCircle;

  const cls = cx(
    buttonClass(variant, size, { circle: useCircle, active }),
    block && "w-full",
    disabled && "opacity-40 cursor-not-allowed",
    className
  );

  return (
    <button className={cls} disabled={disabled} {...rest}>
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
