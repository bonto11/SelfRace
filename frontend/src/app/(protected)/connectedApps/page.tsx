// src/app/(protected)/connectedApps/page.tsx
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import { PAGE_INTRO, PAGE_INTRO_TITLE, PAGE_INTRO_TEXT } from "@/app/shared/ui/tokens/pageTokens";

import StravaPanel from "@/app/features/strava/components/StravaPanel";

export default function ConnectedAppsPage() {
  return (
    <>
      <AppHeader title="Pripojenené aplikácie" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <StravaPanel />
        </div>
      </div>
    </>
  );
}