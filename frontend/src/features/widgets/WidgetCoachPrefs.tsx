// src/features/widgets/WidgetCoachPrefs.tsx
"use client";

import WidgetCard from "@/shared/components/ui/WidgetCard";
import { useCoachData } from "@/shared/components/dataProviders/CoachDataProvider";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachPrefs({ onOpenDetail }: Props) {
  const { prefs } = useCoachData();
  const sports = prefs.primary_sports ?? prefs.sports ?? [];

  return (
    <WidgetCard
      title="Coach — Preferences"
      note="Tapni pre detail nastavení."
      accent="bg-blue-600"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="opacity-75">Goal</div>
        <div className="font-semibold">{prefs.goal_kind ?? "—"}</div>

        <div className="opacity-75">Weeks</div>
        <div className="font-semibold">{prefs.weeks ?? "—"}</div>

        <div className="opacity-75">Sports</div>
        <div className="font-semibold">{sports.join(", ") || "—"}</div>
      </div>
    </WidgetCard>
  );
}