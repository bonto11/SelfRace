"use client";

import { useState } from "react";

function SportBadge({ kind }: { kind: string }) {
  const label =
    kind === "run" ? "Run" :
    kind === "ride" ? "Ride" :
    kind === "strength" ? "Strength" :
    kind === "mixed" ? "Mixed" : "Other";
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-700">
      {label}
    </span>
  );
}

export type SessionCardProps = {
  id?: string;
  headerLeft: React.ReactNode;
  sportKind?: "run" | "ride" | "strength" | "mixed" | "other" | string;
  title: React.ReactNode;
  subtitle?: string | null;
  meta?: (string | null | undefined)[];
  children?: React.ReactNode;

  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disableToggleIfNoChildren?: boolean;

  hideSubtitleWhenOpen?: boolean;
  hideMetaWhenOpen?: boolean;

  /** zarovná detail k okrajom karty (bez druhého panelu) */
  flushDetail?: boolean;
};

export default function CommonActivityCard({
  id,
  headerLeft,
  sportKind = "other",
  title,
  subtitle,
  meta,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  disableToggleIfNoChildren = false,
  hideSubtitleWhenOpen = true,
  hideMetaWhenOpen = true,
  flushDetail = false,
}: SessionCardProps) {
  const isControlled = typeof open === "boolean";
  const [internal, setInternal] = useState<boolean>(defaultOpen);
  const opened = isControlled ? (open as boolean) : internal;

  const canToggle = !disableToggleIfNoChildren || !!children;

  const toggle = () => {
    if (!canToggle) return;
    const next = !opened;
    if (isControlled) onOpenChange?.(next);
    else setInternal(next);
  };

  const metaLine = (meta ?? []).filter(Boolean).join(" · ");

  return (
    <section
      id={id}
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "px-5 py-4",
        "overflow-hidden" //new
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{headerLeft}</div>

        <div className="flex items-center gap-2">
          <SportBadge kind={sportKind} />
          <button
            type="button"
            aria-expanded={opened}
            onClick={toggle}
            disabled={!canToggle}
            title={opened ? "Skryť detail" : "Otvoriť detail"}
            className={[
              "h-8 w-8 grid place-items-center rounded-full border border-white/10",
              canToggle ? "bg-white/10 hover:bg-white/20 transition-colors" : "opacity-40 cursor-not-allowed",
            ].join(" ")}
          >
            <span
              className={[
                "text-base leading-none select-none transition-transform",
                opened ? "rotate-180" : "rotate-0",
              ].join(" ")}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-1 text-base font-semibold tracking-tight truncate">
        {title}
      </div>

      {/* Subtitle */}
      {(!opened || !hideSubtitleWhenOpen) && (
        <div className={subtitle ? "text-xs opacity-80" : "text-xs opacity-40"}>
          {subtitle || null}
        </div>
      )}

      {/* Meta */}
      {metaLine && (!opened || !hideMetaWhenOpen) && (
        <div className="text-xs mt-1 opacity-80">{metaLine}</div>
      )}

      {/* Detail */}
      {opened && children ? (
        flushDetail ? (
          // zarovnaj k okrajom karty + pridaj vnútorný padding pre obsah
          <div className="-mx-5 -mb-4">
            <div className="px-4 pb-4">{children}</div>
          </div>
        ) : (
          <div className="mt-4">{children}</div>
        )
      ) : null}
    </section>
  );
}