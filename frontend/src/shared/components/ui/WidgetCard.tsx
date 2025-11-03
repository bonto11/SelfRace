// src/shared/components/ui/WidgetCard.tsx
"use client";

import Link from "next/link";
import React from "react";

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
    "w-full text-left rounded-2xl shadow-lg border border-white/10",
    "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
    isInteractive &&
      "transition-colors hover:bg-white dark:hover:bg-gray-900/80 cursor-pointer",
    "focus:outline-none p-4",
    className
  );

  // ak accent je farba -> použijeme style; inak ponecháme Tailwind class
  const accentIsColor = isColorValue(accent);
  const accentClass = accentIsColor ? "" : accent; // pôvodné
  const accentStyle = accentIsColor ? { background: accent as string } : undefined;

  const content = (
    <div className={cx("flex flex-col", innerClassName)} style={{ minHeight: minH }}>
      {(title || isInteractive) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {title ? (
            <h3 className="text-sm md:text-base font-semibold tracking-tight">
              {title}
            </h3>
          ) : (
            <span className="sr-only">Widget</span>
          )}
          {isInteractive && (
            <span className="text-xs opacity-75 whitespace-nowrap">
              otvoriť detail ⟶
            </span>
          )}
        </div>
      )}

      <div className="flex-1">
        {children}
        {note && <p className="opacity-80 text-sm mt-2">{note}</p>}
      </div>

      {footer && <div className="mt-3">{footer}</div>}

      {/* spodná lišta */}
      <div className={cx("h-1.5 rounded-b-xl mt-3", accentClass)} style={accentStyle} />
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
      <button type="button" onClick={onOpen} className={outer} aria-label={title || "Widget"}>
        {content}
      </button>
    );
  }
  return <div className={outer}>{content}</div>;
}