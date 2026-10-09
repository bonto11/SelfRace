// src/app/(protected)/activities/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import WidgetGrid from "@/app/shared/widgets/WidgetGrid";

import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { useT } from "@/app/shared/i18n/useT";

function RefreshIconBtn() {
  const { refresh, loading } = useActivityData();
  const t = useT();
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

export default function ActivitiesPage() {
  const t = useT();

  return (
    <PageShell
      title={t("activities.title")}
      showBack={false}
      showPoweredByStrava
      rightSlot={<RefreshIconBtn />}
    >
      {/* Úvodný sprievodca (WidgetOnboarding) je na Domove. */}
      <WidgetGrid section="activities" />
    </PageShell>
  );
}
