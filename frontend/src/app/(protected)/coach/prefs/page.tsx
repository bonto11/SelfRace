// src/app/coach/prefs/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";

export default function Page() {
  return (
    <>
      <AppHeader title="Coach — Preferences" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <CoachPreferencies />
        </div>
      </div>
    </>
  );
}