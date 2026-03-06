// src/app/(protected)/bio/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import ProfileMetricInputs from "@/app/features/profile/components/ProfileMetricInputs";
import ProfileStaticInputs from "@/app/features/profile/components/ProfileStaticInputs";
import { useT } from "@/app/shared/i18n/useT";

export default function BioPage() {
  const t = useT();

  return (
    <PageShell title={t("bio.title")} showBack={true} showPoweredByStrava={false}>
      <div className="flex flex-col gap-6">
        <ProfileStaticInputs />
        <ProfileMetricInputs />
      </div>
    </PageShell>
  );
}
