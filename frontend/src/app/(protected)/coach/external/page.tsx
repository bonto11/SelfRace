// src/app/coach/external/page.tsx
"use client";

import { useUserId } from "@/shared/hooks/useUserId";
import ButtonBack from "@/shared/components/ui/Button";
import { DetailExternalEvents } from "@/features/coach/components/DetailExternalEvents";
import { useRouter } from "next/navigation";

export default function CoachExternalPage() {
  const { userId } = useUserId();
  const router = useRouter();

  if (!userId) {
    return (
      <main className="max-w-screen-lg mx-auto px-3 py-6">
        <p className="text-sm opacity-80">
          Najprv sa prosím prihlás, aby sme vedeli načítať tvoje externé eventy.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-screen-lg mx-auto px-3 py-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">External activities & events</h1>
        <ButtonBack title="External Events" />
      </div>

      <DetailExternalEvents userId={userId} />
    </main>
  );
}