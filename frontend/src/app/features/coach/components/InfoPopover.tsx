"use client";

import { useState } from "react";
import { SURFACE_INSET } from "@/app/shared/theme/uiTokens";

export function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs"
      >
        i
      </button>
      {open && (
        <div
          className={[
            SURFACE_INSET,
            "absolute right-0 mt-2 w-[min(74vw,360px)] p-3 text-xs leading-snug z-30",
          ].join(" ")}
        >
          {text}
        </div>
      )}
    </div>
  );
}
