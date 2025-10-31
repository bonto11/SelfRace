"use client";

import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();
  const sports = prefs.primary_sports ?? prefs.sports ?? [];

  return (
    <OpenerWidget
      title="Coach — Preferences"
      accent="bg-blue-600"
      onOpenDetail={onOpenDetail}
      note="Tapni pre detail nastavení."
    >
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="opacity-75">Goal</div>
        <div className="font-semibold">{prefs.goal_kind ?? "—"}</div>

        <div className="opacity-75">Weeks</div>
        <div className="font-semibold">{prefs.weeks ?? "—"}</div>

        <div className="opacity-75">Sports</div>
        <div className="font-semibold">{sports.join(", ") || "—"}</div>
      </div>
    </OpenerWidget>
  );
}
