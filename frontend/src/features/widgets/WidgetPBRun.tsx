"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useCoachData } from "@/features/coach/data/CoachDataProvider";

type Props = {
  onOpenDetail?: () => void; // použije OpenerWidget
};

function kmFromM(m?: number | null) {
  if (!m && m !== 0) return "";
  return (Math.round((m / 1000) * 10) / 10).toFixed(1);
}

export default function WidgetPBRun({ onOpenDetail }: Props) {
  const { pbRun } = useCoachData();

  // vyťahni pár najznámejších
  const byM = (m: number) => pbRun.find((b) => b.distance_m === m);
  const pb1k = byM(1000)?.time_str ?? "—";
  const pb5k = byM(5000)?.time_str ?? "—";
  const pb10k = byM(10000)?.time_str ?? "—";
  const pbHalf = byM(21097)?.time_str ?? "—";

  return (
    <OpenerWidget
      title="Personal Bests — Run"
      accent="bg-emerald-600"
      onOpenDetail={onOpenDetail}
      note="Tapni pre detail a úpravy rekordov."
    >
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="opacity-80">1 km</div><div className="font-semibold tabular-nums">{pb1k}</div>
        <div className="opacity-80">5 km</div><div className="font-semibold tabular-nums">{pb5k}</div>
        <div className="opacity-80">10 km</div><div className="font-semibold tabular-nums">{pb10k}</div>
        <div className="opacity-80">Half</div><div className="font-semibold tabular-nums">{pbHalf}</div>
      </div>
    </OpenerWidget>
  );
}