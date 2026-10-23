"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVisualViewport } from "@/app/shared/hooks/useVisualViewport";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const OVERLAY_PAD_PX = 24;

/**
 * Modal výživy: portál (inak by sa v karte s backdrop-filter zarovnal ku
 * karte), plná farba karty a výška podľa viditeľnej časti obrazovky –
 * na iOS klávesnica okno nezmenší, len ho prekryje (pole na písanie jedla
 * by ostalo pod ňou).
 */
export default function NutritionModal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const t = useT();
  const viewport = useVisualViewport();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // pole, do ktorého user píše, posunieme do stredu nad klávesnicu
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !el.contains(target)) return;
      window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, []);

  const overlayStyle: CSSProperties = viewport
    ? { zIndex: 2147483000, top: viewport.offsetTop, height: viewport.height }
    : { zIndex: 2147483000 };

  const maxHeight = viewport
    ? viewport.keyboardOpen
      ? viewport.height - OVERLAY_PAD_PX
      : Math.min(viewport.height - OVERLAY_PAD_PX, viewport.height * 0.9)
    : undefined;

  return createPortal(
    <div
      className={[
        "fixed left-0 right-0 flex items-end sm:items-center justify-center bg-black/60 p-3",
        viewport ? "" : "inset-0",
      ].join(" ")}
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={["w-full sm:max-w-lg rounded-2xl flex flex-col", viewport ? "" : "max-h-[90dvh]"].join(" ")}
        style={{
          ...SURFACE_CARD_STYLE,
          background: appColors.surfaceSolid,
          overscrollBehavior: "contain",
          maxHeight,
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: `1px solid ${appColors.divider}` }}
        >
          <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 shrink-0 rounded text-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label={t("common.cancel")}
          >
            ×
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 px-4 py-3 flex gap-2 justify-end" style={{ borderTop: `1px solid ${appColors.divider}` }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
