// src/app/(protected)/coach/streak/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailStreak from "@/app/features/coach/components/DetailStreak"
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      title={t("streak.detail.title")}
      showBack
      showPoweredByStrava={false}
    >
      <DetailStreak />
    </PageShell>
  );
}