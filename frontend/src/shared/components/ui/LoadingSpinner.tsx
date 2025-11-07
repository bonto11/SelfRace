"use client";

import React from "react";
import { SPINNER_CFG } from "@/shared/ui/classes";

type SpinnerSize = "widget" | "trend" | "screen";

type Props = {
  size?: SpinnerSize;     // default: "trend"
  className?: string;     // len na zarovnanie (flex, mt-2…)
};

// jednoduchý helper, nech netreba clsx
function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export default function LoadingSpinner({ size = "trend", className }: Props) {
  const { px, accent, track, dot } = SPINNER_CFG[size];
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