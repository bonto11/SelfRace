// src/app/(protected)/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import PageShell from "@/app/shared/ui/components/PageShell";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import Button from "@/app/shared/ui/components/Button";
import IconRefresh from "@/app/shared/svg/Refresh";
import { WidgetEmpty } from "@/app/shared/ui/widget/WidgetParts";
import { useT } from "@/app/shared/i18n/useT";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import WidgetOnboarding from "@/app/features/activities/widgets/WidgetOnboarding";
import CatalogWidget from "@/app/shared/widgets/CatalogWidget";
import { EditWidgetsLink, WIDGETS_SETTINGS_HREF } from "@/app/shared/widgets/WidgetGrid";
import { useWidgetLayout } from "@/app/shared/widgets/useWidgetLayout";
import { WIDGET_BY_ID } from "@/app/shared/widgets/widgetCatalog";

function RefreshIconBtn() {
  const t = useT();
  const { refresh: refreshActivities, loading: loadingActivities } = useActivityData();
  const { refresh: refreshCoach, loading: loadingCoach } = useCoachData();
  const loading = loadingActivities || loadingCoach;

  return (
    <Button
      circle
      size="sm"
      variant="ghost"
      aria-label={t("common.refreshTitle")}
      title={t("common.refreshTitle")}
      onClick={() => {
        refreshActivities(true);
        refreshCoach(true);
      }}
      disabled={loading}
    >
      <IconRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </Button>
  );
}

/**
 * Domov = widgety, ktoré si user vybral (Nastavenia → Moje widgety).
 * Ostatné zapnuté widgety sú v sekciách, vypnuté nikde.
 */
export default function HomePage() {
  const t = useT();
  const router = useRouter();
  const { home, isAvailable, editable, ensurePlanStatus } = useWidgetLayout();

  // dnešný tréning a iné widgety plánu sa ukážu, len keď plán beží
  const needsPlan = home.some((id) => WIDGET_BY_ID[id].needs?.length);
  useEffect(() => {
    if (needsPlan) ensurePlanStatus?.();
  }, [needsPlan, ensurePlanStatus]);

  const ids = home.filter(isAvailable);

  return (
    <PageShell title={t("home.title")} showBack={false} showPoweredByStrava rightSlot={<RefreshIconBtn />}>
      <WidgetOnboarding />

      {ids.length ? (
        <div className={PAGE_GRID_2}>
          {ids.map((id) => (
            <CatalogWidget key={id} id={id} />
          ))}
        </div>
      ) : (
        <section className={[CARD, "p-4"].join(" ")} style={SURFACE_CARD_STYLE}>
          <WidgetEmpty icon={LayoutGrid} text={t("home.empty")}>
            {editable ? (
              <div>
                <Button size="sm" variant="secondary" onClick={() => router.push(WIDGETS_SETTINGS_HREF)}>
                  {t("home.edit")}
                </Button>
              </div>
            ) : null}
          </WidgetEmpty>
        </section>
      )}

      {ids.length ? (
        <div className="mt-4">
          <EditWidgetsLink label={t("home.edit")} />
        </div>
      ) : null}
    </PageShell>
  );
}
