"use client";

import * as React from "react";

/**
 * Jednoduchý farebný "chip" / pilulka.
 * - `color` je HEX/RGB/HSL – použije sa aj na border a text.
 * - Ak necháš `outline=false` (default), priesvitné pozadie + jemný border.
 * - Pri `outline=true` je pozadie transparentné a farbený je len text + border.
 */
type Props = {
  label: string;
  color: string;          // napr. "#10B981"
  className?: string;
  outline?: boolean;
  title?: string;
};

export default function Pill({ label, color, className, outline = false, title }: Props) {
  const style: React.CSSProperties = outline
    ? { background: "transparent", border: `1px solid ${color}66`, color }
    : { background: `${color}1A`,  border: `1px solid ${color}66`, color };

  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold select-none",
        className || "",
      ].join(" ")}
      style={style}
      title={title}
    >
      {label}
    </span>
  );
}