// src/app/(protected)/trends/vo2max/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendVO2Max from "@/app/features/profile/components/TrendVO2Max";

export default function Page() {
  return (
    <PageShell title="VO₂Max" showBack showPoweredByStrava={false}>
      <TrendVO2Max />
    </PageShell>
  );
}
