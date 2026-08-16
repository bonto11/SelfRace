"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function ProgressBar({
  value,
  label,
}: {
  value: number; // 0-100
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div style={{ fontSize: 11, color: appColors.textMuted, marginBottom: 4 }}>
          {label}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height: 6,
          borderRadius: 999,
          background: appColors.surfaceCardBorder,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: appColors.chartRun ?? "#10b981",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
