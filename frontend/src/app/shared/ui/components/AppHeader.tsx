// src/shared/components/ui/AppHeader.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { cx, buttonClass } from "@/app/shared/ui/utils/inputs";
import { PAGE_CONTAINER } from "@/app/shared/ui/tokens";
import {
  APPBAR_WRAP,
  APPBAR_INNER,
  APPBAR_PILL,
  APPBAR_ROW,
  APPBAR_TITLE,
  APPBAR_RIGHT,
  APPBAR_TITLE_STACK,
  APPBAR_BRAND_WRAP,
  APPBAR_BRAND_IMG,
} from "@/app/shared/ui/tokens/header";

import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useAppHeaderOffset } from "@/app/shared/ui/components/AppHeaderOffsetContext";

/** Priestor, ktorý dostala stránka od layoutu (na PC vedľa bočnej navigácie). */
export type HeaderFrame = { left: number; width: number };

type Props = {
  title?: string;
  showBack?: boolean;
  href?: string;
  fallbackHref?: string;
  backLabel?: string;
  className?: string;
  innerClassName?: string;
  sticky?: boolean;
  container?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  /** text pre „i“ vedľa tlačidla späť – rovnaké vysvetlenie ako vo widgete */
  info?: string;
  showPoweredByStrava?: boolean;
  poweredByStravaVariant?: "white" | "orange";
  // zavolá sa so skutočnou výškou headeru po vykreslení,
  // aby ho PageShell mohol použiť na presné odsadenie obsahu.
  onHeightChange?: (heightPx: number) => void;
  /**
   * Kde presne má fixed hlavička ležať. Bez neho sa roztiahne cez celé
   * okno (left 0, right 0) - čo na PC s bočnou navigáciou nesedí s obsahom.
   */
  frame?: HeaderFrame | null;
};

export default function AppHeader({
  title,
  showBack = true,
  href,
  fallbackHref = "/",
  backLabel = "Späť",
  className,
  innerClassName,
  sticky = true,
  container = false,
  onBack,
  rightSlot,
  info,
  showPoweredByStrava = false,
  poweredByStravaVariant = "white",
  onHeightChange,
  frame,
}: Props) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Offset zhora - 56px na protected stránkach (pod globálnou hlavičkou s
  // logom a UserMenu), 0 na stránkach mimo protected layoutu (žiadna taká
  // hlavička tam nie je). Pozri AppHeaderOffsetContext.
  const topOffsetPx = useAppHeaderOffset();

  useEffect(() => {
    if (!onHeightChange || !wrapRef.current) return;

    const el = wrapRef.current;
    const report = () => onHeightChange(el.offsetHeight);

    report();

    const ro = new ResizeObserver(report);
    ro.observe(el);

    return () => ro.disconnect();
  }, [onHeightChange, title]);

  const goBack = () => {
    onBack?.();
    if (typeof window !== "undefined" && window.history.length > 1)
      router.back();
    else router.push(fallbackHref);
  };

  const backCls = buttonClass("back", "sm", { circle: false });

  const BackPill = (
    <span className={backCls}>
      <ArrowLeft size={16} aria-hidden="true" />
      {backLabel}
    </span>
  );

  const Right = rightSlot ? (
    rightSlot
  ) : showBack ? (
    href ? (
      <Link href={href} aria-label={backLabel}>
        {BackPill}
      </Link>
    ) : (
      <button
        type="button"
        onClick={goBack}
        aria-label={backLabel}
        className="focus:outline-none"
        onMouseDown={(e) => e.preventDefault()}
      >
        {BackPill}
      </button>
    )
  ) : null;

  const poweredSrc =
    poweredByStravaVariant === "orange"
      ? STRAVA_ASSETS.poweredBySvg_orange
      : STRAVA_ASSETS.poweredBySvg_white;

  // Fixed hlavička leží presne nad priestorom stránky, ak ho poznáme.
  const horizontal: React.CSSProperties = frame
    ? { left: frame.left, width: frame.width }
    : { left: 0, right: 0 };

  return (
    <div
      ref={wrapRef}
      className={cx(!sticky && APPBAR_WRAP, className)}
      style={
        sticky
          ? {
              position: "fixed",
              top: `calc(${topOffsetPx}px + env(safe-area-inset-top))`,
              ...horizontal,
              zIndex: 40,
            }
          : undefined
      }
      role="banner"
    >
      <div className={cx(container ? PAGE_CONTAINER : "", APPBAR_INNER)}>
        <div
          className={cx(APPBAR_PILL, innerClassName)}
          style={{
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
          }}
        >
          <div className={APPBAR_ROW}>
            {title ? (
              <div className={APPBAR_TITLE_STACK}>
                <h1 className={APPBAR_TITLE}>{title}</h1>

                {showPoweredByStrava && (
                  <div className={APPBAR_BRAND_WRAP}>
                    <img
                      src={poweredSrc}
                      alt="Powered by Strava"
                      className={APPBAR_BRAND_IMG}
                      draggable={false}
                    />
                  </div>
                )}
              </div>
            ) : (
              <span />
            )}

            <div className={APPBAR_RIGHT}>
              {info ? (
                <span className="inline-flex items-center gap-2">
                  <TooltipIcon text={info} />
                  {Right}
                </span>
              ) : (
                Right
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
