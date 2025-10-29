"use client";

import React from "react";
import clsx from "clsx";

type Size = "sm" | "md";

type Props = {
  size?: Size;          // "sm" do widgetov, "md" do sekcií/grafov
  className?: string;   // voliteľne na zarovnanie (flex, mrg…)
};

const cfg: Record<Size, { px: number; color: string; track: string; dot?: string }> = {
  // malý: modrý akcent, subtílna stopa
  sm: { px: 18, color: "#3B82F6", track: "#3B82F633", dot: "#93C5FD" },
  // stredný: zelený akcent, výraznejšia stopa
  md: { px: 32, color: "#10B981", track: "#10B98133", dot: "#A7F3D0" },
};

export default function LoadingSpinner({ size = "md", className }: Props) {
  const { px, color, track, dot } = cfg[size];
  const border = Math.max(2, Math.round(px / 8));

  const ringStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderWidth: border,
    borderStyle: "solid",
    borderColor: track,     // „vnútorná“ farba stopy
    borderTopColor: color,  // akcent – pohybujúca sa časť
  };

  const dotSize = Math.max(2, Math.round(px / 6));

  return (
    <span className={clsx("inline-flex items-center justify-center", className)}>
      <span
        className="rounded-full animate-spin"
        style={ringStyle}
        role="status"
        aria-label="Loading"
      />
      {/* voliteľná vnútorná bodka – iná pre sm/md cez cfg */}
      {dot && (
        <span
          className="absolute rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: dot,
          }}
        />
      )}
    </span>
  );
}