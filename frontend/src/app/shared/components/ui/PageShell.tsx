// src/app/shared/components/ui/PageShell.tsx
"use client";

import * as React from "react";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

type Props = {
  title: string;
  showBack?: boolean;
  headerContainer?: boolean;

  /** default: stack = PAGE_STACK wrapper */
  variant?: "stack" | "raw";

  /** applied on inner wrapper (stack/raw) */
  contentClassName?: string;

  /** applied on PAGE_CONTAINER */
  className?: string;

  children: React.ReactNode;
};

export default function PageShell({
  title,
  showBack = false,
  headerContainer = true,
  variant = "stack",
  className,
  contentClassName,
  children,
}: Props) {
  return (
    <>
      <AppHeader title={title} showBack={showBack} container={headerContainer} />

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