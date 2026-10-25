// src/app/(protected)/coach/season/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import { useFeatures } from "@/app/shared/state/featureFlagsStore";
import { WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import SeasonPlanEditor from "@/app/features/coach/components/SeasonPlanEditor";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";

/** Plán obdobia (advisor kostra) – za prepínačom season_plan, bez neho na Domov. */
export default function Page() {
  const t = useT();
  const router = useRouter();
  const { flags, ready } = useFeatures();
  const enabled = flags.season_plan === true;

  useEffect(() => {
    if (ready && !enabled) router.replace("/dashboard");
  }, [ready, enabled, router]);

  return (
    <PageShell info={coachInfo(t, "season")} title={t("seasonPlan.title")} showBack showPoweredByStrava={false}>
      {enabled ? <SeasonPlanEditor /> : <WidgetLoading />}
    </PageShell>
  );
}
