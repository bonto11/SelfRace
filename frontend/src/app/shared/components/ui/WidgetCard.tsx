//shared/components/ui/WidgetCard
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
} from "@/app/shared/ui/classes";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// jednoduchá detekcia CSS farby v stringu
const isColorValue = (v?: string) =>
  !!v && /^(#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})|rgb(a)?\(|hsl(a)?\()/i.test(v);

type Props = {
  title?: string;
  note?: string;
  /** PÔVODNÉ: Tailwind bg-* class, NOVÉ: môže byť aj '#10B981' / 'rgb(...)' / 'hsl(...)' */
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
  accent = "bg-slate-700",
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

  const outer = cx(
    WIDGET_CARD,
    isInteractive && WIDGET_CARD_INTERACTIVE,
    className
  );

  // ak accent je farba -> použijeme style; inak ponecháme Tailwind class
  const accentIsColor = isColorValue(accent);
  const accentClass = accentIsColor ? "" : accent;
  const accentStyle = accentIsColor
    ? { background: accent as string }
    : undefined;

  const content = (
    <div
      className={cx(WIDGET_INNER, innerClassName)}
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
            <span className={WIDGET_HINT}>otvoriť detail ⟶</span>
          )}
        </div>
      )}

      <div className="flex-1">
        {children}
        {note && <p className={WIDGET_NOTE}>{note}</p>}
      </div>

      {footer && <div className={WIDGET_FOOTER}>{footer}</div>}

      {/* spodná lišta */}
      <div className={cx(WIDGET_ACCENT_BAR, accentClass)} style={accentStyle} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={outer} aria-label={title || "Widget"}>
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
        aria-label={title || "Widget"}
      >
        {content}
      </button>
    );
  }
  return <div className={outer}>{content}</div>;
}
