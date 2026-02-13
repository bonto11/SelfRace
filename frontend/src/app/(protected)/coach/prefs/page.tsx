// src/app/coach/prefs/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("prefs.title")} showBack showPoweredByStrava={false}> 
      <CoachPreferencies />
    </PageShell>
  );
}
