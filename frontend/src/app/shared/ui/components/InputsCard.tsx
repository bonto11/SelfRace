// src/app/shared/ui/components/InputsCard.tsx
"use client";

import * as React from "react";

import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip"; // 👈 Import tooltip ikony
import { appColors } from "@/app/shared/ui/theme/app_colors";

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
  tooltip?: string; // 👈 Pridaný parameter pre tooltip

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
  tooltip, // 👈 Prijímame parameter
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

  const tooltipText = (tooltip ?? "").trim();
  const showTooltip = tooltipText.length > 0;

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
        <div className="flex items-center justify-between gap-2 w-full">
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
          
          {/* 🌟 Vykreslenie tooltip ikony napravo v hlavičke */}
          {showTooltip ? <TooltipIcon text={tooltipText} /> : null}
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
