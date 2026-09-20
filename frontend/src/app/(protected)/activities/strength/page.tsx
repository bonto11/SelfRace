//// src/app/(protected)/activities/strength/page.tsx
"use client";

import PageShell from "@/app/shared/ui/components/PageShell";
import DetailStreak from "@/app/features/activities/components/StrengthLogEditor"
import { useT } from "@/app/shared/i18n/useT";

export default function Page() {
  const t = useT();
  return (
    <PageShell
      title={t("strengthLog.widget.title")}
      showBack
      showPoweredByStrava={false}
    >
      <StrengthLogEditor />
    </PageShell>
  );
}
