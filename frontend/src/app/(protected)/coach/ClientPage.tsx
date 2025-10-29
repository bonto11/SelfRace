"use client";
import { useRouter } from "next/navigation";
import WidgetPBRun from "@/features/widgets/WidgetPBRun";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";

export default function CoachPage() {
  const router = useRouter();

  return (
    <div className="grid gap-4">
      <WidgetCoachPrefs onOpenDetail={() => router.push("/coach/prefs")} />
      <WidgetPBRun onOpenDetail={() => router.push("/coach/bests")} />
    </div>
  );
}