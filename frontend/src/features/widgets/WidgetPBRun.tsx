"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";

type Props = {
  onOpenTrend?: () => void;
  onOpenDetail?: () => void;
};

export default function WidgetPBRun({ onOpenDetail }: Props) {
  return (
    <OpenerWidget
      title="Personal Bests – Running"
      accent="bg-emerald-600"
      onOpenDetail={onOpenDetail}
    >
      <div className="text-sm space-y-1">
        <div>5 km — 00:23:18 (Aug 2025)</div>
        <div>10 km — 00:48:50</div>
        <div>21.1 km — 01:48:00</div>
        <p className="opacity-70 text-xs mt-1">Tap to view all results →</p>
      </div>
    </OpenerWidget>
  );
}