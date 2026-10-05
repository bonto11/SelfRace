// src/app/(protected)/connectedApps/page.tsx
"use client";
import { Suspense } from "react";
import PageShell from "@/app/shared/ui/components/PageShell";
import StravaPanel from "@/app/features/strava/components/StravaPanel";
import IntervalsPanel from "@/app/features/intervals/components/IntervalsPanel";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";

export default function ConnectedAppsPage() {
  const t = useT();

  return (
    <PageShell title={t("connectedApps.title")} showBack={false} showPoweredByStrava={false}>
      <p className="text-sm mt-4 mb-4" style={{ color: appColors.textMuted }}>
        {t("connectedApps.subtitle")}
      </p>
      <div className="space-y-4 pb-12">
        {/* Vercel vyžaduje Suspense pre komponenty používajúce useSearchParams */}
        <Suspense fallback={<div className="p-4 opacity-50">{t("common.loading")}</div>}>
          <StravaPanel />
        </Suspense>
        <IntervalsPanel />
      </div>
    </PageShell>
  );
}
