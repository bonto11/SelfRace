// src/app/(protected)/bio/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useCardAccordion } from "@/app/shared/ui/components/useCardAccordion";
import ProfileStaticInputs from "@/app/features/bio/components/StaticInputs";
import { useT } from "@/app/shared/i18n/useT";

export default function BioPage() {
  const t = useT();
  // merania (váha, tuk, VO2max, max tep) sú na stránke Výkon
  const slot = useCardAccordion<"static">();

  return (
    <PageShell
      title={t("bio.title")}
      showBack={true}
      showPoweredByStrava={false}
    >
      <div className="space-y-3 pb-12 mt-4">
        {slot("static", <ProfileStaticInputs />)}
      </div>
    </PageShell>
  );
}
