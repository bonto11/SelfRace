// src/app/(protected)/performance/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import WidgetGrid from "@/app/shared/widgets/WidgetGrid";

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

  return (
    <PageShell
      title={t("performance.title")}
      showBack={false}
      rightSlot={<RefreshIconBtn />}
      showPoweredByStrava={false}
    >
      <WidgetGrid section="performance" />
    </PageShell>
  );
}
