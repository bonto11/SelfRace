"use client";

import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetPBRun from "@/features/widgets/WidgetPBRun";
import { useRouter } from "next/navigation";

export default function CoachOverviewPage() {
  const router = useRouter();

  return (
    <CoachDataProvider>
      <div className="grid sm:grid-cols-2 gap-4">
        <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
        <WidgetPBRun     onOpenDetail={() => router.push("/coach/pb-run")} />
      </div>
    </CoachDataProvider>
  );
}