"use client";

import { useEffect, useRef, useState } from "react";
import { SURFACE_INSET } from "@/app/shared/ui/tokens";
import { POPOVER_BTN, POPOVER_BODY } from "@/app/shared/ui/tokens";

export function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // klik mimo => zavri (aby to neostávalo otvorené)
  useEffect(() => {
    if (!open) return;

    function onDocDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown as any);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Info"
        className={[POPOVER_BTN, "bg-transparent hover:bg-white/5"].join(" ")}
      >
        i
      </button>

      {open && (
        <div
          className={[
            SURFACE_INSET,
            POPOVER_BODY,
            "absolute right-0 mt-2 w-[min(74vw,360px)] z-30",
          ].join(" ")}
          role="dialog"
        >
          {text}
        </div>
      )}
    </div>
  );
}