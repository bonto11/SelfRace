// src/shared/components/icons/ChartScroller.tsx

"use client";

import React from "react";

type Props = {
  size?: number; // px
  color?: string; // CSS farba (napr. "#10b981" alebo "white")
  className?: string;
};

export default function LoadingSpinner({ size = 32, color = "#10b981", className = "" }: Props) {
  const border = Math.round(size / 8);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderWidth: border,
    borderColor: `${color}33`, // priehľadný okraj
    borderTopColor: color,
  };

  return (
    <div
      className={`rounded-full animate-spin border-solid ${className}`}
      style={style}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}