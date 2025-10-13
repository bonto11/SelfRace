// src/features/widgets/CHartScroller.tsx
"use client";
import { PropsWithChildren } from "react";

export default function ChartScroller({
  labels,
  height,
  pxPerLabel = 26,
  children,
}: PropsWithChildren<{
  labels: string[];
  height: number;
  pxPerLabel?: number;
}>) {
  const minWidth = Math.max(720, labels.length * pxPerLabel + 120);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth, height }}>{children}</div>
    </div>
  );
}
