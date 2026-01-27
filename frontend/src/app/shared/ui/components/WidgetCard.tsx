// src/app/shared/components/ui/WidgetCard.tsx
"use client";

import Link from "next/link";
import React from "react";
import CardBackdrop from "@/app/shared/ui/components/CardBackdrop";
import {
  WIDGET_CARD,
  WIDGET_CARD_STYLE,
  WIDGET_CARD_INTERACTIVE,
  WIDGET_INNER,
  WIDGET_TITLE,
  WIDGET_HINT,
  WIDGET_HINT_STYLE,
  WIDGET_NOTE,
  WIDGET_NOTE_STYLE,
  WIDGET_FOOTER,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

function cxLocal(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const isCssPaint = (v?: string) =>
  !!v &&
  /^(#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})|rgb(a)?\(|hsl(a)?\(|linear-gradient\(|radial-gradient\()/i.test(
    v,
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

  const outer = cxLocal(
    WIDGET_CARD,
    isInteractive && WIDGET_CARD_INTERACTIVE,
    "p-0 relative overflow-hidden block",
    className,
  );

  const outerStyle: React.CSSProperties = {
    ...WIDGET_CARD_STYLE,
    // ak chceš zachovať shadow z palette:
    boxShadow: appColors.shadowSoft,
  };

  const accentValue =
    accent ??
    `linear-gradient(90deg, ${appColors.brandPrimary}, ${appColors.accentTeal})`;

  const accentIsPaint = isCssPaint(accentValue);
  const accentStyle = accentIsPaint ? { background: accentValue } : undefined;

  const content = (
    <>
      <CardBackdrop />

      <div
        className={cxLocal(
          WIDGET_INNER,
          "relative flex flex-col p-3",
          innerClassName,
        )}
        style={{ minHeight: minH }}
      >
        {(title || isInteractive) && (
          <div className="flex items-center justify-between gap-2 mb-2">
            {title ? (
              <h3 className={WIDGET_TITLE}>{title}</h3>
            ) : (
              <span className="sr-only">Widget</span>
            )}
            {isInteractive && (
              <span className={WIDGET_HINT} style={WIDGET_HINT_STYLE}>
                otvoriť detail ⟶
              </span>
            )}
          </div>
        )}

        <div className="flex-1">
          {children}
          {note ? (
            <p className={WIDGET_NOTE} style={WIDGET_NOTE_STYLE}>
              {note}
            </p>
          ) : null}
        </div>

        {footer ? <div className={WIDGET_FOOTER}>{footer}</div> : null}
      </div>

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
