// src/shared/components/ui/ButtonBack.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cx, buttonClass } from "@/app/shared/ui";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  SURFACE_INLINE,
  SURFACE_INLINE_STYLE,
} from "@/app/shared/ui/tokens/core";

type Props = {
  title?: string;
  href?: string;
  fallbackHref?: string;
  label?: string;
  className?: string;
  innerClassName?: string;
  sticky?: boolean;
  container?: boolean;
  onBack?: () => void;

  /** max šírka kontentu (default: max-w-screen-lg) */
  maxWidthClassName?: string;
};

export default function ButtonBack({
  title,
  href,
  fallbackHref = "/",
  label = "Späť",
  className,
  innerClassName,
  sticky = true,
  container = true,
  onBack,
  maxWidthClassName = "max-w-screen-lg",
}: Props) {
  const router = useRouter();

  const goBack = () => {
    if (onBack) onBack();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  const backCls = buttonClass("back", "sm", { circle: false });

  const BackPill = (
    <span className={backCls}>
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </span>
  );

  return (
    <div
      className={cx(
        sticky && "sticky top-[max(env(safe-area-inset-top),0px)] z-30",
        // jemné pozadie pod pillkou (bez bieleho)
        "w-full",
        className
      )}
      role="banner"
      style={{
        // “appbar haze” - drž sa appColors, nie white/black
        background: "transparent",
      }}
    >
      <div
        className={cx(
          container ? `${maxWidthClassName} mx-auto` : "",
          // konzistentné bočné okraje
          "px-3"
        )}
      >
        {/* ✅ pill cez celú šírku */}
        <div
          className={cx(
            SURFACE_INLINE,
            "w-full",
            "px-3 py-2",
            "mt-2",
            "mb-2",
            innerClassName
          )}
          style={{
            ...SURFACE_INLINE_STYLE,
            // trochu “appbar” feeling (voliteľné)
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
          }}
        >
          {/* ✅ grid: title vľavo, back fix vpravo */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            {title ? (
              <h1 className="text-lg font-semibold truncate">{title}</h1>
            ) : (
              <span className="sr-only">Header</span>
            )}

            <div className="justify-self-end">
              {href ? (
                <Link href={href} aria-label={label}>
                  {BackPill}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={label}
                  className="focus:outline-none"
                >
                  {BackPill}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}