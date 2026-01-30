// src/app/coach/prefs/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";

export default function Page() {
  return (
    <PageShell title="Coach — Preferences" showBack showPoweredByStrava={false}> 
      <CoachPreferencies />
    </PageShell>
  );
}
