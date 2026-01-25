// src/app/shared/components/ui/PageShell.tsx
"use client";

import * as React from "react";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

type Props = {
  title: string;
  showBack?: boolean;
  /** AppHeader container prop */
  headerContainer?: boolean;

  /** optional short intro under header (if you use PAGE_INTRO tokens elsewhere) */
  intro?: React.ReactNode;

  /** outer container className */
  className?: string;

  /** content wrapper behavior */
  contentVariant?: "stack" | "none";
  contentClassName?: string;

  children: React.ReactNode;
};

export default function PageShell({
  title,
  showBack = false,
  headerContainer = true,
  intro,
  className,
  contentVariant = "stack",
  contentClassName,
  children,
}: Props) {
  return (
    <>
      <AppHeader title={title} showBack={showBack} container={headerContainer} />

      <div className={[PAGE_CONTAINER, className].filter(Boolean).join(" ")}>
        {intro ? <div className="mt-3">{intro}</div> : null}

        {contentVariant === "stack" ? (
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