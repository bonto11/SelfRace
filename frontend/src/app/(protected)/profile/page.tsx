"use client";

import { useRouter } from "next/navigation";
import TableMetrics from "@/app/features/profile/components/FormMetrics";
import WidgetBodyFat from "@/app/shared/components/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/shared/components/widgets/WidgetVO2Max";
import TableStatic from "@/app/features/profile/components/FormStatic";

export default function Page() {
  const router = useRouter();

  return (
    <div className="max-w-screen-lg mx-auto px-3">
      {/* Header */}
      <div
        className="sticky top-[max(env(safe-area-inset-top),0px)] z-20 -mx-3 px-3 pt-2 pb-2
                      bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/40"
      >
        <h1 className="text-lg font-semibold">User profile</h1>
      </div>

      {/* Widgety */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
        <WidgetVO2Max onOpenDetail={() => router.push("/profile/vo2max")} />
        <WidgetBodyFat onOpenDetail={() => router.push("/profile/bodyfat")} />
      </div>

      {/* Tabuľky */}
      <div className="space-y-6 mt-6">
        <TableStatic />
        <TableMetrics />
      </div>
    </div>
  );
}
