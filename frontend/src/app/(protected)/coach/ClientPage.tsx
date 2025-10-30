"use client";

import { useRouter } from "next/navigation";
import { CoachDataProvider } from "@/shared/components/dataProviders/CoachDataProvider";
import WidgetPB from "@/features/widgets/WidgetPB";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";

export default function ClientPage() {
  const router = useRouter();

  return (
    <CoachDataProvider>
      <div className="p-4 grid gap-4 md:grid-cols-2">
        <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      </div>
    </CoachDataProvider>
  );
}
