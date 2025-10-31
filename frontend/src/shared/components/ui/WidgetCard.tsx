"use client";

import Link from "next/link";
import React from "react";

// ak máš helper na classNames, pokojne ho sem doplň
function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  title?: string;
  note?: string;
  accent?: string;              // Tailwind bg-* pre spodnú lištu (default neutrál)
  children?: React.ReactNode;
  className?: string;           // extra pre outer wrapper
  innerClassName?: string;      // extra pre vnútro
  minH?: number;                // min. výška obsahu (bez paddingu), default 160
  href?: string;                // ak dáš href -> <Link>
  onOpen?: () => void;          // ak dáš onOpen -> <button>
  interactive?: boolean;        // zapne hover/kurzor (auto true ak href/onOpen)
  footer?: React.ReactNode;     // voliteľná spodná sekcia pred lištou
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
    // popup look
    "w-full text-left rounded-2xl shadow-lg border border-white/10",
    "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
    // interaction
    isInteractive && "transition-colors hover:bg-white dark:hover:bg-gray-900/80 cursor-pointer",
    "focus:outline-none p-4",
    className
  );

  const content = (
    <div className={cx("flex flex-col", innerClassName)} style={{ minHeight: minH }}>
      {/* header */}
      {(title || isInteractive) && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {title ? (
            <h3 className="text-sm md:text-base font-semibold tracking-tight">{title}</h3>
          ) : (
            <span className="sr-only">Widget</span>
          )}
          {isInteractive && (
            <span className="text-xs opacity-75 whitespace-nowrap">otvoriť detail ⟶</span>
          )}
        </div>
      )}

      {/* body */}
      <div className="flex-1">
        {children}
        {note && <p className="opacity-80 text-sm mt-2">{note}</p>}
      </div>

      {/* optional footer slot */}
      {footer && <div className="mt-3">{footer}</div>}

      {/* spodná lišta (stavový akcent) */}
      <div className={cx("h-1.5 rounded-b-xl mt-3", accent)} />
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