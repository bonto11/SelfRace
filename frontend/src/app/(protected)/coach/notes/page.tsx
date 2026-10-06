"use client";

import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import PageShell from "@/app/shared/ui/components/PageShell";
import DetailCoachNotes from "@/app/features/coach/components/DetailCoachNotes";
import { useT } from "@/app/shared/i18n/useT";

export default function CoachNotesPage() {
  const t = useT();
  return (
    <PageShell
      info={coachInfo(t, "notes")}
      title={t("coachNotes.detail.title")} showBack showPoweredByStrava={false}>
      <DetailCoachNotes />
    </PageShell>
  );
}
