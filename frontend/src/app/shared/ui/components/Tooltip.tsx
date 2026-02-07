"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { appColors } from "@/app/shared/ui/theme/app_colors";

type TooltipState = {
  open: boolean;
  text: string;
};

type TooltipCtx = {
  openTooltip: (text: string) => void;
  closeTooltip: () => void;
};

const Ctx = React.createContext<TooltipCtx | null>(null);

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<TooltipState>({
    open: false,
    text: "",
  });

  const openTooltip = React.useCallback((text: string) => {
    setState({ open: true, text: text ?? "" });
  }, []);

  const closeTooltip = React.useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return (
    <Ctx.Provider value={{ openTooltip, closeTooltip }}>
      {children}
      <TooltipHost state={state} onClose={closeTooltip} />
    </Ctx.Provider>
  );
}

export function useTooltip() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useTooltip must be used within <TooltipProvider>");
  return ctx;
}

function TooltipHost({
  state,
  onClose,
}: {
  state: TooltipState;
  onClose: () => void;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!state.open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state.open, onClose]);

  if (!mounted || !state.open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000000, // vyššie než header, dropdowny, všetko
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 92vw)",
          borderRadius: 18,
          background: appColors.surfaceCard,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          boxShadow: appColors.shadowCard,
          padding: 14,
        }}
      >
        <div
          style={{
            color: appColors.textPrimary,
            fontSize: 14,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
          }}
        >
          {state.text}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            style={{ color: appColors.textPrimary }}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** malé “i” tlačidlo */
export function TooltipIcon({
  text,
  title = "Info",
  size = 28,
  className,
}: {
  text: string;
  title?: string;
  size?: number;
  className?: string;
}) {
  const { openTooltip } = useTooltip();

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openTooltip(text);
      }}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `1px solid ${appColors.surfaceCardBorder}`,
        background: "rgba(255,255,255,0.06)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          color: appColors.textPrimary,
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          opacity: 0.9,
        }}
      >
        i
      </span>
    </button>
  );
}