"use client";

import { useRouter } from "next/navigation";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import WidgetPBRun from "@/features/widgets/WidgetPBRun";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";

export default function ClientPage() {
  const router = useRouter();

  return (
    <CoachDataProvider>
      <div className="p-4 grid gap-4 md:grid-cols-2">
        <WidgetPBRun onOpenDetail={() => router.push("/coach/pb")} />
        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      </div>
    </CoachDataProvider>
  );
}