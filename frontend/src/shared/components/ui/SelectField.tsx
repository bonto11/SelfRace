// src/shared/components/ui/SelectField.tsx
"use client";

import * as React from "react";
import { inputClass, labelClass, hintClass, cx } from "@/shared/ui";

type Option = {
  value: string;
  label: string;
};

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  options?: Option[];
};

export default function SelectField({
  label,
  hint,
  error,
  containerClassName,
  className,
  children,
  options,
  ...rest
}: Props) {
  return (
    <div className={cx("space-y-1", containerClassName)}>
      {label && <label className={labelClass}>{label}</label>}

      <div className="relative">
        <select
          className={cx(
            inputClass,
            "bg-gray-800 pr-9 appearance-none", // dark select + priestor pre šípku
            className,
            error && "border-red-600"
          )}
          {...rest}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>

        {/* custom šípka vpravo – len vizuál, neklikateľná */}
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="w-3.5 h-3.5 text-white/60"
          >
            {/* taký širší “V” */}
            <path
              d="M3 6.25L8 11l5-4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : (
        hint && <div className={hintClass}>{hint}</div>
      )}
    </div>
  );
}