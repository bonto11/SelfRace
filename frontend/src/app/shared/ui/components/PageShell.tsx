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
};

export default function PageShell({
  title,
  showBack = false,
  headerContainer = true,
  rightSlot,
  variant = "stack",
  className,
  contentClassName,
  children,
}: Props) {
  return (
    <>
      <AppHeader
        title={title}
        showBack={showBack}
        container={headerContainer}
        rightSlot={rightSlot}
      />

      <div className={[PAGE_CONTAINER, className].filter(Boolean).join(" ")}>
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