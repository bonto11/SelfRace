// src/app/(protected)/activities/routes/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailRouteMatch from "@/app/features/activities/components/DetailRouteMatch";
import { useT } from "@/app/shared/i18n/useT";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={activityInfo(t, "routes")}
      title={t("sessions.routeMatch.pageTitle")}
      showBack
      showPoweredByStrava={false}
    >
      <DetailRouteMatch />
    </PageShell>
  );
}