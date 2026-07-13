// src/app/shared/components/session/SectionDetail.tsx
"use client";

import { ReactNode, useState, type CSSProperties } from "react";
import {
  SURFACE_INLINE,
  SURFACE_INLINE_STYLE,
  SESSION_DIVIDER,
  SESSION_DIVIDER_STYLE,
} from "@/app/shared/ui/tokens";

type DetailSectionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

const BTN_CLASS = [SURFACE_INLINE, "w-full flex items-center justify-between px-3 py-2"].join(" ");
const BTN_STYLE: CSSProperties = SURFACE_INLINE_STYLE;

export default function SectionDetail({
  title,
  children,
  defaultOpen = true,
}: DetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={BTN_CLASS}
        style={BTN_STYLE}
      >
        <span className="text-[11px] font-semibold opacity-80 uppercase">
          {title}
        </span>
        <span className={["text-sm transition-transform", open ? "rotate-180" : ""].join(" ")}>
          ▾
        </span>
      </button>

      {open && (
        <div className={["mt-2", SESSION_DIVIDER, "pt-2"].join(" ")} style={SESSION_DIVIDER_STYLE}>
          {children}
        </div>
      )}
    </div>
  );
}