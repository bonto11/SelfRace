// src/app/(protected)/account/connected-apps/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import {
  PAGE_CONTAINER,
  PAGE_STACK,
  PAGE_INTRO,
} from "@/app/shared/ui/tokens/pageTokens";

import StravaPanel from "@/app/features/strava/components/StravaPanel";

export const metadata = {
  title: "Connected apps",
};

export default function ConnectedAppsPage() {
  return (
    <>
      <AppHeader title="Connected apps" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <p className={PAGE_INTRO}>
            Prepojenie so Stravou a ďalšími službami. Tu vieš spravovať pripojenie
            a import tréningov.
          </p>

          <StravaPanel />
        </div>
      </div>
    </>
  );
}