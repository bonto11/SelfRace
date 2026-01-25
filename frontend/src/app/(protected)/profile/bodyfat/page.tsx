// src/app/(protected)/trends/bodyfat/page.tsx
"use client";

import PageShell from "@/app/shared/components/ui/PageShell";
import TrendBodyFat from "@/app/features/profile/components/TrendBodyFat";

export default function Page() {
  return (
    <PageShell title="Detail — Body Fat" showBack>
      <TrendBodyFat />
    </PageShell>
  );
}