// src/app/(protected)/connectedApps/page.tsx
import PageShell from "@/app/shared/ui/components/PageShell";
import StravaPanel from "@/app/features/strava/components/StravaPanel";
import { useT } from "@/app/shared/i18n/useT";

export default function ConnectedAppsPage() {
  const t = useT();

  return (
    <PageShell title={t("connectedApps.title")} showBack={false} showPoweredByStrava={false}>
      <StravaPanel />
    </PageShell>
  );
}
