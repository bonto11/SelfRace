// src/app/(protected)/recovery/page.tsx
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/components/ui/PageShell";
import { PAGE_WIDGET_GRID } from "@/app/shared/ui/tokens/pageTokens";

import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import WidgetRHR from "@/app/shared/components/widgets/WidgetRHR";
import WidgetHRV from "@/app/shared/components/widgets/WidgetHRV";
import WidgetSleepDuration from "@/app/shared/components/widgets/WidgetSleepDuration";
import WidgetSleepStart from "@/app/shared/components/widgets/WidgetSleepStart";

import RecoveryInputs from "@/app/features/recovery/components/RecoveryInputs";

import Button from "@/app/shared/components/ui/Button";
import IconRefresh from "@/app/shared/svg/Refresh";

function RefreshIconBtn() {
  const { refresh, loading } = useRecoveryData();
  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label="Refresh data"
      title="Refresh data"
      onClick={() => refresh(true)}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

export default function RecoveryPage() {
  const router = useRouter();

  return (
    <PageShell title="Recovery" showBack={false} rightSlot={<RefreshIconBtn />}>
      <RecoveryInputs />

      <div className={PAGE_WIDGET_GRID}>
        <WidgetRHR onOpenDetail={() => router.push("/recovery/rhr")} />
        <WidgetHRV onOpenDetail={() => router.push("/recovery/hrv")} />
        <WidgetSleepDuration onOpenDetail={() => router.push("/recovery/sleepDuration")} />
        <WidgetSleepStart onOpenDetail={() => router.push("/recovery/sleepStart")} />
      </div>
    </PageShell>
  );
}