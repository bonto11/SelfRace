"use client";

import { useRouter } from "next/navigation";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import Pill from "@/shared/components/ui/Pill";
import { THEME } from "@/shared/theme/tokens";

export default function WidgetCoachPlan({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const router = useRouter();

  // pre nálepky zobrazíme, či už niečo je v storage
  let hasGenerated = false;
  try { hasGenerated = !!localStorage.getItem("coach.generated"); } catch {}

  return (
    <WidgetCard
      title="Coach — Plan"
      note="Vygeneruj plán, spusti a priebežne aktualizuj."
      accent={THEME.chart.athletes}
      onOpen={onOpenDetail}
      interactive
      minH={140}
    >
      <div className="flex items-center gap-2 text-xs">
        <Pill label={hasGenerated ? "generated ✓" : "no plan"} color={hasGenerated ? THEME.chart.good : THEME.chart.neutral} />
        <span className="opacity-70">Tapni pre detail a akcie</span>
      </div>
    </WidgetCard>
  );
}