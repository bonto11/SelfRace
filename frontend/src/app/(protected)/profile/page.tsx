"use client";

import { useRouter } from "next/navigation";
import AppHeader from "@/app/shared/components/ui/AppHeader";
import {
  PAGE_CONTAINER,
  PAGE_STACK,
  PAGE_WIDGET_GRID,
  PAGE_SECTION_STACK,
} from "@/app/shared/ui/tokens/pageTokens";

import TableMetrics from "@/app/features/profile/components/FormMetrics";
import WidgetBodyFat from "@/app/shared/components/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/shared/components/widgets/WidgetVO2Max";
import TableStatic from "@/app/features/profile/components/FormStatic";

export default function Page() {
  const router = useRouter();

  return (
    <>
      <AppHeader title="User profile" showBack={false} container />

      <div className={PAGE_CONTAINER}>
        <div className={PAGE_STACK}>
          {/* Widgety */}
          <div className={PAGE_WIDGET_GRID}>
            <WidgetVO2Max onOpenDetail={() => router.push("/profile/vo2max")} />
            <WidgetBodyFat onOpenDetail={() => router.push("/profile/bodyfat")} />
          </div>

          {/* Tabuľky */}
          <div className={PAGE_SECTION_STACK}>
            <TableStatic />
            <TableMetrics />
          </div>
        </div>
      </div>
    </>
  );
}