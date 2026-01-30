// src/app/coach/external/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";

import { useUserId } from "@/app/shared/hooks/useUserId";
import DetailExternalEvents from "@/app/features/coach/components/DetailExternalEvents";

export default function Page() {
  const { userId } = useUserId();

  return (
    <PageShell title="External activities & events" showBack showPoweredByStrava={false}>
      <DetailExternalEvents userId={userId ?? undefined} />
    </PageShell>
  );
}
