// src/app/(protected)/connectedApps/page.tsx
"use client";
import { Suspense } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";
import StravaPanel from "@/app/features/strava/components/StravaPanel";
import { useT } from "@/app/shared/i18n/useT";

export default function ConnectedAppsPage() {
  const t = useT();

  return (
    <PageShell title={t("connectedApps.title")} showBack={false} showPoweredByStrava={false}>
      {/* Vercel vyžaduje Suspense pre komponenty používajúce useSearchParams */}
      <Suspense fallback={<div className="p-4 opacity-50">{t("common.loading")}</div>}>
        <StravaPanel />
      </Suspense>
    </PageShell>
  );
}