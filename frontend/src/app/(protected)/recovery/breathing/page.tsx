// src/app/(protected)/recovery/breathing/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { useT } from "@/app/shared/i18n/useT";
import { useFeatures } from "@/app/shared/state/featureFlagsStore";
import { WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import BreathingPlayer from "@/app/features/recovery/components/BreathingPlayer";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";

/** Vedené dychové cvičenie – za prepínačom recovery_extras, bez neho na Domov. */
export default function Page() {
  const t = useT();
  const router = useRouter();
  const { flags, ready } = useFeatures();
  const enabled = flags.recovery_extras === true;

  useEffect(() => {
    if (ready && !enabled) router.replace("/dashboard");
  }, [ready, enabled, router]);

  return (
    <PageShell info={t("breathing.info")} title={t("breathing.title")} showBack showPoweredByStrava={false}>
      {enabled ? (
        <div className={`${CARD} mt-4 p-4`} style={SURFACE_CARD_STYLE}>
          <BreathingPlayer />
        </div>
      ) : (
        <WidgetLoading />
      )}
    </PageShell>
  );
}
