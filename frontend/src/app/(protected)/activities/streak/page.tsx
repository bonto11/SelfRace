// src/app/(protected)/coach/streak/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailStreak from "@/app/features/activities/components/DetailStreak"
import { useT } from "@/app/shared/i18n/useT";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={activityInfo(t, "streak")}
      title={t("streak.detail.title")}
      showBack
      showPoweredByStrava={false}
    >
      <DetailStreak />
    </PageShell>
  );
}