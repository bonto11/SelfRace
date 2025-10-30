"use client";

import React from "react";
import { createPortal } from "react-dom";
import { ActivityDataProvider } from "@/shared/components/dataProviders/ActivityDataProvider";
import ActivityDetail from "@/shared/components/ActivityDetail";

type Props = {
  activityId: number;
  open: boolean;
  onClose: () => void;
};

export default function ActivityDetailOverlay({
  activityId,
  open,
  onClose,
}: Props) {
  if (!open) return null;

  // lock scroll tela
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const node = (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-auto">
      <div className="min-h-full p-3 md:p-6 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl">
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-base md:text-lg font-semibold">
              Detail aktivity
            </h3>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            >
              Zavrieť
            </button>
          </div>
          <div className="p-3 md:p-4">
            {/* Provider si nesie so sebou – ActivityDetail bude fungovať aj mimo /activity */}
            <ActivityDataProvider>
              <ActivityDetail activityId={activityId} />
            </ActivityDataProvider>
          </div>
        </div>
      </div>
    </div>
  );

  // portal = overlay mimo stacking kontextov stránky
  return createPortal(node, document.body);
}
