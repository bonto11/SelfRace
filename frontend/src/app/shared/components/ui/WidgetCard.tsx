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
} from "@/app/shared/ui/tokens";
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

  // ✅ dôležité: zrušíme "kartu v karte"
  // - outer nech je jediná karta (border/shadow/rounded/overflow)
  // - padding presunieme do vnútra
  // - accent bar dáme FULL WIDTH na spodok outeru (nie do paddingu)
  const outer = cx(
    WIDGET_CARD,
    isInteractive && WIDGET_CARD_INTERACTIVE,
    "p-0 relative overflow-hidden block", // p-0 prepíše WIDGET_CARD p-3
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
  const accentStyle = accentIsPaint ? { background: accentValue } : undefined;

  const content = (
    <>
      {/* Backdrop vrstvy priamo v OUTER (nie v inner) */}
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
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.52))",
        }}
      />

      {/* Reálny obsah (padding tu) */}
      <div
        className={cx(WIDGET_INNER, "relative flex flex-col p-3", innerClassName)}
        style={{ minHeight: minH }}
      >
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
      </div>

      {/* ✅ Accent FULL WIDTH na spodku OUTER (už nie je “vnorený”) */}
      <div
        className="h-1.5 w-full"
        style={{
          ...(accentStyle ?? {}),
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
        }}
      />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={outer}
        style={outerStyle}
        aria-label={title || "Widget"}
      >
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