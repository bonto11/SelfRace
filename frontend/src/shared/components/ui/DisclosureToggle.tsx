// src/shared/components/ui/DisclosureToggle.tsx
"use client";

import * as React from "react";
import Button from "@/shared/components/ui/Button";
import { cx } from "@/shared/ui";

type Props = {
  open: boolean;
  onToggle: () => void;
  className?: string;
  /** voliteľné override textov pre screen readery */
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
          "w-3.5 h-3.5 transition-transform duration-150 text-white/80",
          open ? "rotate-180" : "rotate-0"
        )}
      >
        {/* Širší “V”, ako si chcel – keď je closed, je to V; pri open sa otočí na ∧ */}
        <path
          d="M3 6.25L8 11l5-4.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Button>
  );
}