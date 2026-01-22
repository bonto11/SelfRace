// src/app/coach/pb/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

import AccordionBests from "@/app/features/bests/components/AccordionBests";

export default function Page() {
  return (
    <>
      <AppHeader title="Personal Bests" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <AccordionBests />
        </div>
      </div>
    </>
  );
}