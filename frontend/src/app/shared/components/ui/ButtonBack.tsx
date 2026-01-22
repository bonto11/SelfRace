// src/shared/components/ui/ButtonBack.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { appColors } from "@/app/shared/theme/app_colors";
import { cx, buttonClass, PAGE_CONTAINER } from "@/app/shared/ui";
import {
  APPBAR_WRAP,
  APPBAR_INNER,
  APPBAR_PILL,
  APPBAR_ROW,
  APPBAR_TITLE,
  APPBAR_RIGHT,
} from "@/app/shared/ui/tokens/header";

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
};

export default function ButtonBack({
  title,
  href,
  fallbackHref = "/",
  label = "Späť",
  className,
  innerClassName,
  sticky = true,
  container = false,
  onBack,
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
      className={cx(sticky && APPBAR_WRAP, className)}
      role="banner"
    >
      <div className={cx(container ? PAGE_CONTAINER : "", APPBAR_INNER)}>
        {/* pill cez celú šírku kontajnera (tvoj “Garmin/Strava” look) */}
        <div
          className={cx(APPBAR_PILL, innerClassName)}
          style={{
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
          }}
        >
          <div className={APPBAR_ROW}>
            {title ? (
              <h1 className={APPBAR_TITLE}>{title}</h1>
            ) : (
              <span className="sr-only">Header</span>
            )}

            <div className={APPBAR_RIGHT}>
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
                  onMouseDown={(e) => e.preventDefault()} // iOS “sticky focus”
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