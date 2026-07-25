// src/app/shared/components/ui/PageShell.tsx
"use client";

import * as React from "react";
import AppHeader from "@/app/shared/ui/components/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens";

type Props = {
  title: string;
  showBack?: boolean;
  headerContainer?: boolean;
  rightSlot?: React.ReactNode;
  variant?: "stack" | "raw";
  contentClassName?: string;
  className?: string;
  children: React.ReactNode;
  showPoweredByStrava: boolean;
};

// Rozumny fallback kym sa nezmeria skutocna vyska (pri prvom rendri, kym
// ResizeObserver este nenahlasil realnu hodnotu) - lepsie mat mierne priveľký
// padding na zlomok sekundy nez ziadny.
const FALLBACK_HEADER_HEIGHT_PX = 76;

export default function PageShell({
  title,
  showBack = false,
  headerContainer = true,
  rightSlot,
  variant = "stack",
  className,
  contentClassName,
  children,
  showPoweredByStrava,
}: Props) {
  const [headerHeight, setHeaderHeight] = React.useState(FALLBACK_HEADER_HEIGHT_PX);

  return (
    <>
      <AppHeader
        title={title}
        showBack={showBack}
        container={headerContainer}
        rightSlot={rightSlot}
        showPoweredByStrava={showPoweredByStrava}
        onHeightChange={setHeaderHeight}
      />

      <div
        className={[PAGE_CONTAINER, className].filter(Boolean).join(" ")}
        style={{ paddingTop: headerHeight }}
      >
        {variant === "stack" ? (
          <div className={[PAGE_STACK, contentClassName].filter(Boolean).join(" ")}>
            {children}
          </div>
        ) : (
          <div className={contentClassName}>{children}</div>
        )}
      </div>
    </>
  );
}
