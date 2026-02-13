// src/app/coach/pb/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import AccordionBests from "@/app/features/bests/components/AccordionBests";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();

  return (
    <PageShell title={t("PB.title")} showBack showPoweredByStrava={false}>
      <AccordionBests />
    </PageShell>
  );
}
