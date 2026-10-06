// src/app/(protected)/coach/race-countdown/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailRaceCountdown from "@/app/features/coach/components/DetailRaceCountdown"
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      info={coachInfo(t, "race")}
      title={t("upcomingRace.detail.title") as any || "Závody"}
      showBack
      showPoweredByStrava={false}
    >
      <DetailRaceCountdown />
    </PageShell>
  );
}

