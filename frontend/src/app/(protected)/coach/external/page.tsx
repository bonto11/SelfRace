// src/app/coach/external/page.tsx
"use client";

import AppHeader from "@/app/shared/components/ui/AppHeader";
import { PAGE_CONTAINER, PAGE_STACK } from "@/app/shared/ui/tokens/pageTokens";

import { useUserId } from "@/app/shared/hooks/useUserId";
import DetailExternalEvents from "@/app/features/coach/components/DetailExternalEvents";

export default function Page() {
  const { userId } = useUserId();

  return (
    <>
      <AppHeader title="External activities & events" showBack container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          <DetailExternalEvents userId={userId ?? undefined} />
        </div>
      </div>
    </>
  );
}