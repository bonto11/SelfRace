// src/app/(protected)/connectedApps/page.tsx
import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import { PAGE_INTRO, PAGE_INTRO_TITLE, PAGE_INTRO_TEXT } from "@/app/shared/ui/tokens/pageIntro";

import StravaPanel from "@/app/features/strava/components/StravaPanel";

export default function ConnectedAppsPage() {
  return (
    <>
      <AppHeader title="Connected apps" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <header className={PAGE_INTRO}>
            <h2 className={PAGE_INTRO_TITLE}>Connected apps</h2>
            <p className={PAGE_INTRO_TEXT}>
              Prepojenie so Stravou a ďalšími službami. Tu vieš spravovať pripojenie
              a import tréningov.
            </p>
          </header>

          <StravaPanel />
        </div>
      </div>
    </>
  );
}