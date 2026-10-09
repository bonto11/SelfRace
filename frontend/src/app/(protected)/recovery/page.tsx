// src/app/(protected)/recovery/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import WidgetGrid from "@/app/shared/widgets/WidgetGrid";

import RecoveryInputs from "@/app/features/recovery/components/RecoveryInputs";
import IntervalsSyncButton from "@/app/features/recovery/components/IntervalsSyncButton";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { useT } from "@/app/shared/i18n/useT";

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

  return (
    <PageShell
      title={t("recovery.title")}
      showBack={false}
      rightSlot={
        <div className="flex items-center gap-1">
          <IntervalsSyncButton />
          <RefreshIconBtn />
        </div>
      }
      showPoweredByStrava={false}
    >
      {/* ranný zápis je vstup, nie widget – ostáva vždy */}
      <div className="mt-4">
        <RecoveryInputs />
      </div>

      <WidgetGrid section="recovery" />
    </PageShell>
  );
}
