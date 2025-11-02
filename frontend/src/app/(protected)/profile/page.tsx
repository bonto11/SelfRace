"use client";

import { useRouter } from "next/navigation";
import TableMetrics from "@/features/profile/components/TableMetrics";
import TableHistory from "@/features/profile/components/TableHistory";
import WidgetBodyFat from "@/features/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/features/widgets/WidgetVO2Max";
import TableStatic from "@/features/profile/components/TableStatic";

export default function Page() {
  const router = useRouter();

  return (
    <div className="max-w-screen-lg mx-auto px-3">
      {/* Header */}
      <div className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2
                      bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40">
        <h1 className="text-lg font-semibold">User profile</h1>
      </div>

      {/* Widgety */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetVO2Max onOpen={() => router.push("/profile/vo2max")} />
        <WidgetBodyFat onOpen={() => router.push("/profile/bodyfat")} />
      </div>

      {/* Tabuľky */}
      <div className="space-y-6 mt-6">
        <TableStatic />
        <TableMetrics />
        <TableHistory />
      </div>
    </div>
  );
}