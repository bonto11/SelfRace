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
      <select
        className={cx(
          inputClass,
          "bg-gray-800 pr-8", // trochu viac miesta pre šípku
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
      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : (
        hint && <div className={hintClass}>{hint}</div>
      )}
    </div>
  );
}