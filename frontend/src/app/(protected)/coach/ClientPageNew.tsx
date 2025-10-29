"use client";

import CoachPrefsWidget from "@/features/coach/widgets/CoachPrefsWidget";
import CoachPBRunWidget from "@/features/coach/widgets/CoachPBRunWidget";
import { useRouter } from "next/navigation";

export default function CoachHubPage() {
  const r = useRouter();
  return (
    <div className="space-y-4">
      <CoachPrefsWidget onOpenDetail={()=>r.push("/coach/prefs")} />
      <CoachPBRunWidget onOpenDetail={()=>r.push("/coach/pb-run")} />
    </div>
  );
}