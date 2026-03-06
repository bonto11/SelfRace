// src/app/(protected)/profile/page.tsx  (alebo kde to reálne máš)
"use client";

import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";

import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import WidgetPB from "@/app/shared/components/widgets/WidgetPB";
import WidgetBodyFat from "@/app/shared/components/widgets/WidgetBodyFat";
import WidgetVO2Max from "@/app/shared/components/widgets/WidgetVO2Max";
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
    const t = useT();

  const router = useRouter();

  return (
    <PageShell title={t("profile.title")} showBack={false} showPoweredByStrava={false}>
      <div className={PAGE_GRID_2}>
        <WidgetPB onOpenDetail={() => router.push("/coach/pb")} />
        <WidgetVO2Max onOpenDetail={() => router.push("/profile/vo2max")} />
        <WidgetBodyFat onOpenDetail={() => router.push("/profile/bodyfat")} />
      </div>
    </PageShell>
  );
}
