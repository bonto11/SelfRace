// src/app/shared/ui/components/Toggle.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all border select-none mb-1 shadow-sm"
      style={{
        backgroundColor: checked ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
        borderColor: checked ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
      }}
    >
      <div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        {description && (
          <div className="text-[11px] text-white/50 mt-0.5 font-medium">
            {description}
          </div>
        )}
      </div>
      <div
        className={`relative inline-flex items-center h-[22px] rounded-full w-10 transition-colors ${
          checked ? "" : "bg-white/10"
        }`}
        style={checked ? { backgroundColor: appColors.brandPrimary } : {}}
      >
        <span
          className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </div>
    </div>
  );
}