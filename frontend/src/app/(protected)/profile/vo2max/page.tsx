// src/app/(protected)/trends/vo2max/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import TrendVO2Max from "@/app/features/profile/components/TrendVO2Max";

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — VO₂Max" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <TrendVO2Max />
        </div>
      </div>
    </>
  );
}