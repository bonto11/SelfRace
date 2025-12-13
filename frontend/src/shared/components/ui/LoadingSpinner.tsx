//shared/components/ui/LoadingSpinner
"use client";

import React from "react";
import { SPINNER_CFG } from "@/shared/ui/classes";

/** dostupné veľkosti – doplnené o `button` (najmenší) */
type SpinnerSize = "button" | "widget" | "trend" | "screen";

type Props = {
  size?: SpinnerSize;         // default: "trend"
  className?: string;         // zarovnanie (flex, mt-2…)
  ariaLabel?: string;         // override ARIA labelu
};

/** jednoduchý helper, nech netreba clsx */
function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

/** bezpečný fallback, ak v SPINNER_CFG chýba niektorý kľúč */
const FALLBACK_CFG: Record<SpinnerSize, { px: number; accent: string; track: string; dot?: string | null }> = {
  button: { px: 16, accent: "#fff", track: "rgba(255,255,255,.25)", dot: null },
  widget: { px: 22, accent: "#fff", track: "rgba(255,255,255,.25)", dot: null },
  trend:  { px: 28, accent: "#fff", track: "rgba(255,255,255,.25)", dot: null },
  screen: { px: 44, accent: "#fff", track: "rgba(255,255,255,.25)", dot: null },
};

export default function LoadingSpinner({
  size = "trend",
  className,
  ariaLabel,
}: Props) {
  // vezmi z SPINNER_CFG, ak tam kľúč je; inak fallback
  const base = (SPINNER_CFG as any)?.[size] ?? FALLBACK_CFG[size];
  const px = Number(base.px ?? FALLBACK_CFG[size].px);
  const accent = base.accent ?? FALLBACK_CFG[size].accent;
  const track = base.track ?? FALLBACK_CFG[size].track;
  const dotClr = base.dot ?? FALLBACK_CFG[size].dot ?? undefined;

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
    <span className={cx("relative inline-flex items-center justify-center align-middle", className)}>
      <span
        className="rounded-full animate-spin"
        style={ringStyle}
        role="status"
        aria-label={ariaLabel ?? "Loading"}
      />
      {dotClr && (
        <span
          className="absolute rounded-full"
          style={{ width: dotSize, height: dotSize, backgroundColor: dotClr as string }}
        />
      )}
    </span>
  );
}