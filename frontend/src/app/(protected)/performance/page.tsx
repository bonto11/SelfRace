"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";

import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

// Existujúce widgety
import WidgetPB from "@/app/shared/components/widgets/WidgetPB";
import WidgetBodyFat from "@/app/shared/components/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/shared/components/widgets/WidgetVO2Max";

// Nové widgety
import WidgetZonesHR from "@/app/features/performance/components/WidgetZonesHR";
import WidgetZonesPaces from "@/app/features/performance/components/WidgetZonesPaces";
import WidgetEstTopPaces from "@/app/features/performance/components/WidgetEstTopPaces";

import { useT } from "@/app/shared/i18n/useT";

export default function PerformancePage() {
  const t = useT();
  const router = useRouter();

  return (
    <PageShell 
      title={t("performance.title") || "Výkon"} 
      showBack={false} 
      showPoweredByStrava={false}
    >
      <div className={PAGE_GRID_2}>
        {/* 1. SEKCIA: Preteky a Osobáky */}
        <WidgetEstTopPaces onOpenDetail={() => router.push("/performance/estimatedTopPace")} />
        <WidgetPB onOpenDetail={() => router.push("/performance/pb")} />

        {/* 2. SEKCIA: Tréningový Motor (Zóny a Tempá) */}
        <WidgetZonesHR onOpenDetail={() => router.push("/performance/zonesHR")} />
        <WidgetZonesPaces onOpenDetail={() => router.push("/performance/zonesPace")} />

        {/* 3. SEKCIA: Biometria a Kapacita */}
        <WidgetVO2Max onOpenDetail={() => router.push("/performance/vo2max")} />
        <WidgetBodyFat onOpenDetail={() => router.push("/performance/bodyfat")} />
      </div>
    </PageShell>
  );
}
