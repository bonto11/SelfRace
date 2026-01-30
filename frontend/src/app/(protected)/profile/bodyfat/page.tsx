// src/app/(protected)/trends/bodyfat/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import TrendBodyFat from "@/app/features/profile/components/TrendBodyFat";

export default function Page() {
  return (
    <PageShell title="Telesný tuk" showBack showPoweredByStrava={false}>
      <TrendBodyFat />
    </PageShell>
  );
}
