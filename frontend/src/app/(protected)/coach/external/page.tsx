// src/app/coach/external/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";

import { useUserId } from "@/app/shared/hooks/useUserId";
import DetailExternalEvents from "@/app/features/coach/components/DetailExternalEvents";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const { userId } = useUserId();
  const t = useT();

  return (
    <PageShell
      info={coachInfo(t, "external")}
      title={t("externalEvents.title")}
      showBack
      showPoweredByStrava={false}
    >
      <DetailExternalEvents userId={userId ?? undefined} />
    </PageShell>
  );
}
