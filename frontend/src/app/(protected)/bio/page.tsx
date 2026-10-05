// src/app/(protected)/bio/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useCardAccordion } from "@/app/shared/ui/components/useCardAccordion";
import ProfileMetricInputs from "@/app/features/bio/components/MetricInputs";
import ProfileStaticInputs from "@/app/features/bio/components/StaticInputs";
import { useT } from "@/app/shared/i18n/useT";

export default function BioPage() {
  const t = useT();
  const slot = useCardAccordion<"static" | "metrics">();

  return (
    <PageShell
      title={t("bio.title")}
      showBack={true}
      showPoweredByStrava={false}
    >
      <div className="space-y-3 pb-12 mt-4">
        {slot("static", <ProfileStaticInputs />)}
        {slot("metrics", <ProfileMetricInputs />)}
      </div>
    </PageShell>
  );
}
