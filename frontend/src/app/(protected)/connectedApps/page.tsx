// src/app/(protected)/connectedApps/page.tsx
import PageShell from "@/app/shared/ui/components/PageShell";
import StravaPanel from "@/app/features/strava/components/StravaPanel";

export default function ConnectedAppsPage() {
  return (
    <PageShell title="Pripojenené aplikácie" showBack={false}>
      <StravaPanel />
    </PageShell>
  );
}
