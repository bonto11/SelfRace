"use client";

import { useRouter } from "next/navigation";
import WidgetPB from "@/features/widgets/WidgetPB";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetActivitiesCalendar from "@/features/widgets/WidgetActivitiesCalendar";

export default function Page() {
  const router = useRouter();

  return (
    <div className="p-4 grid gap-4 md:grid-cols-2">
      <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetActivitiesCalendar />
    </div>
  );
}
