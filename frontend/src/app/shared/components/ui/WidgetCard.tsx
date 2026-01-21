// shared/components/ui/WidgetCard.tsx
"use client";

import Link from "next/link";
import React from "react";
import {
  WIDGET_CARD,
  WIDGET_CARD_INTERACTIVE,
  WIDGET_INNER,
  WIDGET_TITLE,
  WIDGET_HINT,
  WIDGET_NOTE,
  WIDGET_FOOTER,
  WIDGET_ACCENT_BAR,
} from "@/app/shared/theme/uiTokens";
import { appColors } from "@/app/shared/theme/app_colors";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const isCssPaint = (v?: string) =>
  !!v &&
  /^(#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})|rgb(a)?\(|hsl(a)?\(|linear-gradient\(|radial-gradient\()/i.test(
    v
  );

type Props = {
  title?: string;
  note?: string;
  accent?: string;
  children?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  minH?: number;
  href?: string;
  onOpen?: () => void;
  interactive?: boolean;
  footer?: React.ReactNode;
};

export default function WidgetCard({
  title,
  note,
  accent,
  children,
  className,
  innerClassName,
  minH = 160,
  href,
  onOpen,
  interactive,
  footer,
}: Props) {
  const isInteractive = interactive ?? Boolean(href || onOpen);

  // keep existing token classes (padding etc.), but make the OUTER the only “card”
  const outer = cx(
    WIDGET_CARD,
    isInteractive && WIDGET_CARD_INTERACTIVE,
    "relative overflow-hidden", // ✅ all gradients/background live here (no card-in-card)
    className
  );

  // ✅ FORCE “landing-like” frame (dočasne fixne)
  const outerStyle: React.CSSProperties = {
    background: appColors.surfaceCard,
    border: `1px solid ${appColors.surfaceCardBorder}`,
    boxShadow: appColors.shadowSoft,
  };

  const accentValue =
    accent ??
    `linear-gradient(90deg, ${appColors.brandPrimary}, ${appColors.accentTeal})`;

  const accentIsPaint = isCssPaint(accentValue);
  const accentClass = accentIsPaint ? "" : accentValue;
  const accentStyle = accentIsPaint ? { background: accentValue } : undefined;

  const content = (
    <>
      {/* ✅ background layers belong to the OUTER card */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(520px 260px at 30% 20%, rgba(63,225,166,0.12), transparent 60%),
            radial-gradient(520px 300px at 80% 70%, rgba(45,212,191,0.10), transparent 62%)
          `,
          opacity: 0.95,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.52))",
        }}
      />

      {/* ✅ real content (no extra rounded card inside) */}
      <div className={cx(WIDGET_INNER, "relative z-10", innerClassName)} style={{ minHeight: minH }}>
        {(title || isInteractive) && (
          <div className="flex items-center justify-between gap-2 mb-2">
            {title ? (
              <h3 className={WIDGET_TITLE}>{title}</h3>
            ) : (
              <span className="sr-only">Widget</span>
            )}
            {isInteractive && <span className={WIDGET_HINT}>otvoriť detail ⟶</span>}
          </div>
        )}

        <div className="flex-1">
          {children}
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </div>

        {footer && <div className={WIDGET_FOOTER}>{footer}</div>}

        {/* ✅ accent spans the FULL outer card width (no “karta v karte”) */}
        <div
          className={cx(
            WIDGET_ACCENT_BAR,
            accentClass,
            "w-full -mx-3 -mb-3 mt-3 rounded-b-2xl" // p-3 in WIDGET_CARD -> extend to edges
          )}
          style={accentStyle}
        />
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={outer} style={outerStyle} aria-label={title || "Widget"}>
        {content}
      </Link>
    );
  }

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={outer}
        style={outerStyle}
        aria-label={title || "Widget"}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={outer} style={outerStyle}>
      {content}
    </div>
  );
}