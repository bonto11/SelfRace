// src/app/coach/external/page.tsx
"use client";

import ButtonBack from "@/shared/components/ui/ButtonBack";
import { useUserId } from "@/shared/hooks/useUserId";
import DetailExternalEvents from "@/features/coach/components/DetailExternalEvents";

export default function Page() {
  const { userId } = useUserId();

  return (
    <div className="max-w-screen-lg mx-auto px-3">
      <ButtonBack title="External activities & events" />
      <div className="pt-3">
        <DetailExternalEvents userId={userId ?? undefined} />
      </div>
    </div>
  );
}