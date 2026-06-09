// src/app/(protected)/recovery/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import WidgetRHR from "@/app/shared/components/widgets/WidgetRHR";
import WidgetHRV from "@/app/shared/components/widgets/WidgetHRV";
import WidgetSleepDuration from "@/app/shared/components/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/app/shared/components/widgets/WidgetSleepStart";
import WidgetReadiness from "@/app/shared/components/widgets/WidgetReadiness";

import RecoveryInputs from "@/app/features/recovery/components/RecoveryInputs";
import ShowAdvancedToggle from "@/app/shared/ui/components/ShowAdvancedToggle";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";

function RefreshIconBtn() {
  const t = useT();
  const { refresh, loading } = useRecoveryData();
  return (
    <Button circle size="sm" variant="ghost"
      aria-label={t("common.refreshTitle")}
      title={t("common.refreshTitle")}
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function RecoveryPage() {
  const t = useT();
  const router = useRouter();
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  return (
    <PageShell
      title={t("recovery.title")}
      showBack={false}
      rightSlot={<RefreshIconBtn />}
      showPoweredByStrava={false}
    >
      <div className="mt-4 mb-2">
        <ShowAdvancedToggle />
      </div>

      <RecoveryInputs />

      <div className={PAGE_GRID_2}>
        {/* Readiness Score — hlavný widget, vždy viditeľný */}
        <WidgetReadiness onOpenDetail={() => router.push("/recovery/readiness")} />

        <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
        <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />

        {showAdvanced && (
          <>
            <WidgetSleepDuration onOpenDetail={() => router.push("/recovery/sleepDuration")} />
            <WidgetSleepStart    onOpenDetail={() => router.push("/recovery/sleepStart")} />
          </>
        )}
      </div>
    </PageShell>
  );
}
