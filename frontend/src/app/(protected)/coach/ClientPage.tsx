"use client";

import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetPBRun from "@/features/widgets/WidgetPBRun";
import { useRouter } from "next/navigation";

export default function ClientPage() {
  const r = useRouter();
  return (
    <div className="space-y-4">
      <WidgetCoachPrefs onOpenDetail={()=>r.push("/coach/prefs")} />
      <WidgetPBRun onOpenDetail={()=>r.push("/coach/pb-run")} />
    </div>
  );
}