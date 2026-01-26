// src/app/coach/pb/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import AccordionBests from "@/app/features/bests/components/AccordionBests";

export default function Page() {
  return (
    <PageShell title="Personal Bests" showBack>
      <AccordionBests />
    </PageShell>
  );
}
