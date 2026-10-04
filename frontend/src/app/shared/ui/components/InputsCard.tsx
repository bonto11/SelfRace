// src/app/shared/ui/components/InputsCard.tsx
"use client";

import * as React from "react";

import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip"; // 👈 Import tooltip ikony
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { Check, ChevronDown } from "lucide-react";

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

/**
 * Riadenie karty zvonka (akordeón). PREČO kontext a nie props: sekcie
 * nastavení si InputsCard renderujú samé - takto ich rodič prepne do
 * kompaktného režimu bez úpravy každej sekcie. Mimo providera sa karta
 * správa ako doteraz.
 */
export type InputsCardControl = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** done = zelená fajka, default = štítok s predvolenými hodnotami, todo = prázdny krúžok */
  status: "done" | "default" | "todo";
  /** text stavu - tooltip ikony, pri "default" aj viditeľný štítok */
  statusLabel?: string;
  /** spodok otvorenej karty (Hotovo / Obnoviť) */
  footer?: React.ReactNode;
};

export const InputsCardControlContext =
  React.createContext<InputsCardControl | null>(null);

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
  const control = React.useContext(InputsCardControlContext);
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
  const isControlled = typeof open === "boolean";
  const isOpen = control
    ? control.open
    : isControlled
      ? (open as boolean)
      : innerOpen;

  const setOpen = (v: boolean) => {
    if (control) {
      control.onOpenChange(v);
      return;
    }
    if (!isControlled) setInnerOpen(v);
    onOpenChange?.(v);
  };

  const tooltipText = (tooltip ?? "").trim();
  const showTooltip = tooltipText.length > 0;

  if (control) {
    return (
      <section
        className={[CARD, "relative overflow-hidden", className]
          .filter(Boolean)
          .join(" ")}
        style={SURFACE_CARD_STYLE}
      >
        <CardBackdrop variant={backdropVariant} />

        {/* HEAD - celý riadok otvára/zatvára kartu */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          onClick={(e) => {
            // klik na vnorené ovládacie prvky (tooltip, tlačidlá) kartu neprepína
            if (
              (e.target as HTMLElement).closest(
                "button, a, input, select, textarea",
              )
            )
              return;
            setOpen(!isOpen);
          }}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(!isOpen);
            }
          }}
          className={`${CARD_HEAD_INSET} relative cursor-pointer select-none`}
          style={{ paddingTop: 14, paddingBottom: isOpen ? 4 : 14 }}
        >
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="min-w-0">
              <div
                className={PANEL_SECTION_TITLE}
                style={{ color: appColors.textPrimary }}
              >
                {title}
              </div>
              {isOpen && subtitle ? (
                <div
                  className={PANEL_SECTION_SUBTITLE}
                  style={{ color: appColors.textMuted }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {showTooltip ? <TooltipIcon text={tooltipText} /> : null}
              {control.status === "default" ? (
                <span
                  className="rounded-full"
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    border: `1px solid ${appColors.surfaceCardBorder}`,
                    color: appColors.textMuted,
                    whiteSpace: "nowrap",
                  }}
                >
                  {control.statusLabel}
                </span>
              ) : (
                <span
                  aria-label={control.statusLabel}
                  title={control.statusLabel}
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    border: `1.5px solid ${
                      control.status === "done"
                        ? appColors.brandPrimary
                        : appColors.surfaceCardBorder
                    }`,
                    background:
                      control.status === "done" ? appColors.brandPrimary : "transparent",
                  }}
                >
                  {control.status === "done" ? (
                    <Check size={14} strokeWidth={3} color={appColors.buttonPrimaryText} />
                  ) : null}
                </span>
              )}
              <ChevronDown
                size={18}
                color={appColors.textMuted}
                style={{
                  transform: isOpen ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </div>
          </div>
        </div>

        {isOpen ? (
          <div className={`${CARD_BODY_INSET} relative`}>
            {always ? <div>{always}</div> : null}
            {/* vnorené karty už nie sú súčasťou akordeónu */}
            <InputsCardControlContext.Provider value={null}>
              <div>{children}</div>
            </InputsCardControlContext.Provider>
            {actions ? (
              <div className={INPUTS_CARD_FOOTER}>
                <div className={INPUTS_CARD_SAVE_WRAP}>{actions}</div>
              </div>
            ) : null}
            {control.footer ? <div className="mt-4">{control.footer}</div> : null}
          </div>
        ) : null}
      </section>
    );
  }

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
