// src/shared/components/ui/AppHeader.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { cx, buttonClass } from "@/app/shared/ui";
import { PAGE_CONTAINER } from "@/app/shared/ui/tokens";
import {
  APPBAR_WRAP,
  APPBAR_INNER,
  APPBAR_PILL,
  APPBAR_ROW,
  APPBAR_TITLE,
  APPBAR_RIGHT,

  // ✅ NEW tokens
  APPBAR_TITLE_STACK,
  APPBAR_BRAND_IMG,
} from "@/app/shared/ui/tokens/header";

import { STRAVA_ASSETS } from "@/app/shared/ui/components/Strava"; // ✅ NEW

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

  // ✅ NEW
  showPoweredByStrava?: boolean;
  poweredByStravaVariant?: "white" | "orange";
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

  // ✅ NEW
  showPoweredByStrava = true,
  poweredByStravaVariant = "white",
}: Props) {
  const router = useRouter();

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

  return (
    <div className={cx(sticky && APPBAR_WRAP, className)} role="banner">
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

            <div className={APPBAR_RIGHT}>{Right}</div>
          </div>
        </div>
      </div>
    </div>
  );
}