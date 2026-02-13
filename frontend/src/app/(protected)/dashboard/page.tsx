// src/app/(protected)/dashboard/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

export default function ActivitiesPage() {
  const t = useT();

  return (
    <PageShell
      title={t("dashboard.title")}
      showBack={false}
      showPoweredByStrava
    >
      <div className="p-6">{t("dashboard.title")}</div>
    </PageShell>
  );
}