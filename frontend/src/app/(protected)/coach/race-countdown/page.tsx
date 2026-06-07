// src/app/(protected)/coach/race-countdown/page.tsx
"use client";

import dynamic from "next/dynamic";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";

const RaceCountdownDetail = dynamic(
  () => import("@/app/features/coach/components/RaceCountdownDetail"),
  { ssr: false }
);

export default function Page() {
  const t = useT();
  return (
    <PageShell
      title={t("upcomingRace.detail.title") as any || "Závody"}
      showBack
      showPoweredByStrava={false}
    >
      <RaceCountdownDetail />
    </PageShell>
  );
}

