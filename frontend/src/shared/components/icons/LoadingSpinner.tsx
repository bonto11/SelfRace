"use client";

import React from "react";

type SpinnerSize = "widget" | "trend" | "screen";

type Props = {
  size?: SpinnerSize;     // default: "trend"
  className?: string;     // len na zarovnanie (flex, mt-2…)
};

const CFG: Record<SpinnerSize, { px: number; accent: string; track: string; dot?: string }> = {
  // malý do widgetov
  widget: { px: 18, accent: "#3B82F6", track: "#3B82F633", dot: "#93C5FD" }, // modrá
  // stredný do grafov/sekcií
  trend:  { px: 32, accent: "#10B981", track: "#10B98133", dot: "#A7F3D0" }, // zelená
  // veľký na plno-obrazovkové loadingy
  screen: { px: 56, accent: "#8B5CF6", track: "#8B5CF633", dot: "#DDD6FE" }, // fialová
};

// jednoduchý helper, nech netreba clsx
function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export default function LoadingSpinner({ size = "trend", className }: Props) {
  const { px, accent, track, dot } = CFG[size];
  const border = Math.max(2, Math.round(px / 8));
  const dotSize = Math.max(2, Math.round(px / 6));

  const ringStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderWidth: border,
    borderStyle: "solid",
    borderColor: track,     // stopa
    borderTopColor: accent, // akcent – točí sa
  };

  return (
    <span className={cx("relative inline-flex items-center justify-center", className)}>
      <span
        className="rounded-full animate-spin"
        style={ringStyle}
        role="status"
        aria-label="Loading"
      />
      {dot && (
        <span
          className="absolute rounded-full"
          style={{ width: dotSize, height: dotSize, backgroundColor: dot }}
        />
      )}
    </span>
  );
}