// src/app/coach/prefs/page.tsx
"use client";

import PageShell from "@/app/shared/components/ui/PageShell";
import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";

export default function Page() {
  return (
    <PageShell title="Coach — Preferences" showBack>
      <CoachPreferencies />
    </PageShell>
  );
}