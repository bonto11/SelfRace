"use client";
import * as React from "react";
import { buttonClass, type ButtonVariant, type ButtonSize, cx } from "@/shared/ui";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** vynútiť kruh (napr. čisto ikonové tlačidlo) */
  circle?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  leftIcon,
  rightIcon,
  circle,
  className,
  children,
  ...rest
}: Props) {
  // auto-kruh: ak nie je text alebo je to extrémne krátke (1–2 znaky) a bez ikon
  const text =
    typeof children === "string" ? children.trim() : "";
  const autoCircle = circle ?? (!!children && text.length > 0 ? text.length <= 2 : !children);
  const cls = cx(buttonClass(variant, size, { circle: autoCircle }), block && "w-full", className);

  return (
    <button className={cls} {...rest}>
      {leftIcon && !autoCircle && <span className="inline-flex">{leftIcon}</span>}
      {!autoCircle && children}
      {rightIcon && !autoCircle && <span className="inline-flex">{rightIcon}</span>}
      {autoCircle && (leftIcon || rightIcon || children)}
    </button>
  );
}