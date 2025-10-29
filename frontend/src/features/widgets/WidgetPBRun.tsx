"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import type { PBRun } from "@/features/coach/types";

const PB_MOCK: PBRun[] = [
  { distanceKm: 1, best: "00:03:52" },
  { distanceKm: 5, best: "00:23:13" },
  { distanceKm: 10, best: "00:50:17" },
  { distanceKm: 21.1, best: "02:22:07" },
];

function Row({ d }: { d: PBRun }) {
  const label =
    d.distanceKm === 21.1
      ? "Half"
      : d.distanceKm === 42.2
      ? "Marathon"
      : `${d.distanceKm} km`;
  return (
    <div className="flex justify-between text-sm">
      <span className="opacity-80">{label}</span>
      <span className="tabular-nums font-medium">{d.best}</span>
    </div>
  );
}

export default function WidgetPBRun({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  return (
    <OpenerWidget
      title="Coach AI — PB (Running)"
      accent="bg-indigo-600"
      onOpenDetail={onOpenDetail}
    >
      <div className="space-y-1">
        {PB_MOCK.map((pb) => (
          <Row key={pb.distanceKm} d={pb} />
        ))}
      </div>
      <div className="text-xs opacity-70 mt-2">Tap to edit/add PBs</div>
    </OpenerWidget>
  );
}
