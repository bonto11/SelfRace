// src/app/(protected)/performance/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider"; 
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle"; 

import WidgetPB from "@/app/shared/components/widgets/WidgetPB";
import WidgetBodyFat from "@/app/shared/components/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/shared/components/widgets/WidgetVO2Max";
import WidgetBodyWeight from "@/app/shared/components/widgets/WidgetBodyWeight"; // 👈 Pridaný nový widget
import WidgetZonesHR from "@/app/shared/components/widgets/WidgetZonesHR";
import WidgetZonesPaces from "@/app/shared/components/widgets/WidgetZonesPaces";
import WidgetEstTopPaces from "@/app/shared/components/widgets/WidgetEstTopPaces";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { useT } from "@/app/shared/i18n/useT";

function RefreshIconBtn() {
  const t = useT();
  const { refresh, loading } = usePerformanceData();
  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle")}
      title={t("common.refreshTitle")}
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function PerformancePage() {
  const t = useT();
  const router = useRouter();
  
  // Získame globálne nastavenie pokročilého režimu
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  return (
    <PageShell
      title={t("performance.title")}
      showBack={false}
      rightSlot={<RefreshIconBtn />}
      showPoweredByStrava={false}
    >
      {/* Globálny prepínač režimu zobrazenia */}
      <div className="mb-4">
        <ShowAdvancedToggle />
      </div>

      <div className={PAGE_GRID_2}>
        {/* 1. SEKCIA: Výsledky a Osobáky (Vždy viditeľné) */}
        <WidgetEstTopPaces
          onOpenDetail={() => router.push("/performance/estTopPaces")}
        />
        <WidgetPB onOpenDetail={() => router.push("/performance/pb")} />

        {/* 2. SEKCIA: Tréningové metriky (Len v Advanced režime) */}
        {showAdvanced && (
          <>
            <WidgetZonesHR
              onOpenDetail={() => router.push("/performance/zonesHR")}
            />
            <WidgetZonesPaces
              onOpenDetail={() => router.push("/performance/zonesPaces")}
            />
          </>
        )}

        {/* 3. SEKCIA: Biometria (Viditeľné vždy, menia vnútorný vizuál) */}
        <WidgetVO2Max 
          showAdvanced={showAdvanced} 
          onOpenDetail={() => router.push("/performance/vo2max")} 
        />
        
        <WidgetBodyWeight 
          showAdvanced={showAdvanced} 
          onOpenDetail={() => router.push("/performance/bodyweight")} 
        />

        <WidgetBodyFat
          onOpenDetail={() => router.push("/performance/bodyfat")}
        />
      </div>
    </PageShell>
  );
}
