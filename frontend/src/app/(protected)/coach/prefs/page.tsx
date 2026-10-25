// src/app/coach/prefs/page.tsx
"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import CoachPreferencies from "@/app/features/prefs/components/CoachPreferencies";
import { useT } from "@/app/shared/i18n/useT";
import { useFeature } from "@/app/shared/state/featureFlagsStore";

export default function Page() {
  const t = useT();
  const suggestOn = useFeature("prefs_suggest");

  return (
    <PageShell
      info={coachInfo(t, "prefs") + (suggestOn ? `\n\n${t("prefsSuggest.prefsInfoLine")}` : "")}
      title={t("prefs.title")} showBack showPoweredByStrava={false}> 
      <CoachPreferencies />
    </PageShell>
  );
}
