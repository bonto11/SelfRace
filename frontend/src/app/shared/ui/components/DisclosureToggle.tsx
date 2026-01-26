// src/app/shared/components/ui/DisclosureToggle.tsx
"use client";

import * as React from "react";
import Button from "@/app/shared/ui/components/Button";
import { cx } from "@/app/shared/ui";
import {
  DISCLOSURE_ICON_BASE,
  DISCLOSURE_ICON_OPEN,
  DISCLOSURE_ICON_CLOSED,
} from "@/app/shared/ui/tokens";

type Props = {
  open: boolean;
  onToggle: () => void;
  className?: string;
  labelWhenOpen?: string;
  labelWhenClosed?: string;
};

export default function DisclosureToggle({
  open,
  onToggle,
  className,
  labelWhenOpen = "Collapse section",
  labelWhenClosed = "Expand section",
}: Props) {
  const ariaLabel = open ? labelWhenOpen : labelWhenClosed;

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      circle
      onClick={onToggle}
      aria-label={ariaLabel}
      className={className}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cx(
          DISCLOSURE_ICON_BASE,
          open ? DISCLOSURE_ICON_OPEN : DISCLOSURE_ICON_CLOSED
        )}
      >
        <path
          d="M3 6.25L8 11l5-4.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.0"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  );
}
