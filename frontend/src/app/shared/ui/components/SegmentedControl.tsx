"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

type Option<T> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (val: T) => void;
  disabled?: boolean;
};

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: Props<T>) {
  return (
    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 w-full relative">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => !disabled && onChange(opt.value)}
            disabled={disabled}
            className={`
              flex-1 py-1.5 text-[11px] uppercase tracking-wider font-bold rounded-lg transition-all duration-300
              ${isSelected ? "shadow-sm" : "opacity-50 hover:opacity-80"}
            `}
            style={{
              backgroundColor: isSelected ? appColors.brandPrimary : "transparent",
              color: isSelected ? "#000000" : "#ffffff",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}