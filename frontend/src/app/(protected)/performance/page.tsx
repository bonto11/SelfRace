// src/app/(protected)/performance/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useSettings } from "@/app/shared/i18n/SettingsProvider"; 
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle"; 

import WidgetPB from "@/app/features/performance/widgets/WidgetPB";
import WidgetBodyFat from "@/app/features/performance/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/features/performance/widgets/WidgetVO2Max";
import WidgetBodyWeight from "@/app/features/performance/widgets/WidgetBodyWeight";
import WidgetZonesHR from "@/app/features/performance/widgets/WidgetZonesHR";
import WidgetZonesPaces from "@/app/features/performance/widgets/WidgetZonesPaces";
import WidgetEstTopPaces from "@/app/features/performance/widgets/WidgetEstTopPaces";
import WidgetBodyScan from "@/app/features/performance/widgets/WidgetBodyScan";

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
  
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  return (
    <PageShell
      title={t("performance.title")}
      showBack={false}
      rightSlot={<RefreshIconBtn />}
      showPoweredByStrava={false}
    >
      <div className="mb-4">
        <ShowAdvancedToggle />
      </div>

      <div className={PAGE_GRID_2}>
        <WidgetEstTopPaces
          onOpenDetail={() => router.push("/performance/estTopPaces")}
        />
        <WidgetPB onOpenDetail={() => router.push("/performance/pb")} />

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

        <WidgetBodyScan
          onOpenDetail={() => router.push("/performance/bodyScan")}
        />
      </div>
    </PageShell>
  );
}