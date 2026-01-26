"use client";

import * as React from "react";

import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import { appColors } from "@/app/shared/theme/app_colors";

import {
  CARD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  SURFACE_CARD_STYLE,

  // inputsCard tokens
  INPUTS_CARD_FOOTER,
  INPUTS_CARD_SAVE_WRAP,
  INPUTS_CARD_TOGGLE,
} from "@/app/shared/ui/tokens";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;

  /** Always-visible block above preview/body (typicky date row, toolbar, atď.) */
  always?: React.ReactNode;

  /** Collapsed preview text/row */
  preview?: React.ReactNode;

  /** Main content shown only when open */
  children?: React.ReactNode;

  /** Actions shown in footer when open (typicky Save button) */
  actions?: React.ReactNode;

  /** Controlled/uncontrolled */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Optional */
  className?: string;
  backdropVariant?: "default" | "subtle";
};

export default function InputsCard({
  title,
  subtitle,
  always,
  preview,
  children,
  actions,
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  backdropVariant = "default",
}: Props) {
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
  const isControlled = typeof open === "boolean";
  const isOpen = isControlled ? (open as boolean) : innerOpen;

  const setOpen = (v: boolean) => {
    if (!isControlled) setInnerOpen(v);
    onOpenChange?.(v);
  };

  return (
    <section
      className={[CARD, "relative overflow-hidden", className]
        .filter(Boolean)
        .join(" ")}
      style={SURFACE_CARD_STYLE}
    >
      {/* unified card background (same vibe as widgets) */}
      <CardBackdrop variant={backdropVariant} />

      {/* HEAD */}
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET} relative`}>
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              className={PANEL_SECTION_SUBTITLE}
              style={{ color: appColors.textMuted }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      {/* BODY */}
      <div className={`${CARD_BODY_INSET} relative`}>
        {always ? <div>{always}</div> : null}

        {!isOpen && preview ? (
          <div
            className={["mt-3", PANEL_PREVIEW].join(" ")}
            style={{ color: appColors.textMuted }}
          >
            {preview}
          </div>
        ) : null}

        {isOpen ? <div>{children}</div> : null}

        {/* FOOTER */}
        <div className={INPUTS_CARD_FOOTER}>
          {isOpen && actions ? (
            <div className={INPUTS_CARD_SAVE_WRAP}>{actions}</div>
          ) : null}

          <DisclosureToggle
            open={isOpen}
            onToggle={() => setOpen(!isOpen)}
            className={INPUTS_CARD_TOGGLE}
          />
        </div>
      </div>
    </section>
  );
}
