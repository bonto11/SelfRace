// src/app/(protected)/nutrition/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { localeTag } from "@/app/shared/i18n/locale";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useFeatures } from "@/app/shared/state/featureFlagsStore";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useNutritionData } from "@/app/shared/components/dataProviders/NutritionDataProvider";
import NutritionProfileSetup from "@/app/features/nutrition/components/NutritionProfileSetup";
import NutritionDayView from "@/app/features/nutrition/components/NutritionDayView";
import { nutritionInfo } from "@/app/features/nutrition/utils/nutrition";

/**
 * Výživa – rozpracovaná funkcia za prepínačom `nutrition` (admin panel →
 * Funkcie). Bez zapnutej funkcie stránka presmeruje na Domov.
 */
export default function NutritionPage() {
  const t = useT();
  const router = useRouter();
  const { userId, trainerView } = useUserId();
  const { flags, ready } = useFeatures();
  const enabled = flags.nutrition === true;
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { today, loading, refresh } = useNutritionData();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (ready && !enabled) router.replace("/dashboard");
  }, [ready, enabled, router]);

  const readOnly = !!trainerView;
  const needsSetup = !today?.profile || (today?.missing?.length ?? 0) > 0;

  let content;
  if (!enabled || !userId || (loading && !today)) {
    content = <WidgetLoading />;
  } else if (readOnly && !today?.profile) {
    // tréner nemôže zverencovi nastaviť výživu – súhlas dáva len on
    content = (
      <p className="text-sm mt-4" style={{ color: appColors.textMuted }}>
        {t("nutrition.trainer.noProfile")}
      </p>
    );
  } else if (!readOnly && (needsSetup || editing)) {
    content = (
      <NutritionProfileSetup
        userId={userId}
        mode={today?.profile ? "edit" : "setup"}
        onDone={() => {
          setEditing(false);
          void refresh();
        }}
        onCancel={today?.profile && !needsSetup ? () => setEditing(false) : undefined}
      />
    );
  } else {
    content = (
      <NutritionDayView userId={userId} locale={locale} readOnly={readOnly} onEditProfile={() => setEditing(true)} />
    );
  }

  return (
    <PageShell title={t("nutrition.title")} info={nutritionInfo(t)} showBack={false} showPoweredByStrava={false}>
      {content}
    </PageShell>
  );
}
