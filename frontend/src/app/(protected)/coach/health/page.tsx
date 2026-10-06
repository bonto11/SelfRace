"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailHealthLog from "@/app/features/coach/components/DetailHealthLog";
import { useT } from "@/app/shared/i18n/useT";

export default function HealthLogPage() {
  const t = useT();

  return (
    <PageShell
      info={coachInfo(t, "health")} 
      title={t("healthLog.pageTitle")} 
      showBack 
      showPoweredByStrava={false}
    >
      <DetailHealthLog />
    </PageShell>
  );
}