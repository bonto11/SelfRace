// src/shared/components/ActivityDetailOverlay.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import ActivityDetail from "@/shared/components/ActivityDetail";

type Props = {
  activityId: number;
  open: boolean;
  onClose: () => void;
};

export default function ActivityDetailOverlay({ activityId, open, onClose }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open || !mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, mounted]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) onClose();
  };

  const node = (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-auto"
         role="dialog" aria-modal="true" onMouseDown={onBackdrop}>
      <div className="min-h-full p-3 md:p-6 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl outline-none">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-base md:text-lg font-semibold">Detail aktivity</h3>
            <button onClick={onClose} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
              Zavrieť
            </button>
          </div>
          <div className="p-3 md:p-4">
            {/* ActivityDetail musí byť klientsky komponent */}
            <ActivityDetail activityId={activityId} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}