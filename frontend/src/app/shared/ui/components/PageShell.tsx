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

// 🌟 Odhad vysky AppHeader "pilulky" (title + back button riadok) - pouzite
// na odsadenie obsahu, aby nezacinal schovany pod novym fixed page-headerom.
const PAGE_HEADER_HEIGHT_PX = 72;

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
  return (
    <>
      <AppHeader
        title={title}
        showBack={showBack}
        container={headerContainer}
        rightSlot={rightSlot}
        showPoweredByStrava={showPoweredByStrava}
      />

      <div
        className={[PAGE_CONTAINER, className].filter(Boolean).join(" ")}
        style={{ paddingTop: PAGE_HEADER_HEIGHT_PX }}
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
