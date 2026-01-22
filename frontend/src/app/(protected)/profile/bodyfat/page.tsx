// src/app/(protected)/trends/bodyfat/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";
import TrendBodyFat from "@/app/features/profile/components/TrendBodyFat";

export default function Page() {
  return (
    <>
      <AppHeader title="Detail — Body Fat" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <TrendBodyFat />
        </div>
      </div>
    </>
  );
}