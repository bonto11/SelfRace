// src/app/(protected)/activities/session/[activityId]/page.tsx
"use client";

import { useParams } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PANEL_PREVIEW } from "@/app/shared/ui/tokens";

/**
 * 🚧 PLACEHOLDER — zatiaľ len prázdna stránka s "Späť", aby push
 * notifikácie (a widget WidgetLastActivity) mali kam viesť a dalo sa
 * odtiaľ normálne vyjsť. Reálny obsah (SessionCard s dátami aktivity,
 * rovnako ako pri kalendári) doplníme, keď pošleš detail kalendárového
 * flow.
 */
export default function ActivitySessionDetailPage() {
  

  return (
    <PageShell title="Aktivita" showBack showPoweredByStrava={true}>
      <div className={PANEL_PREVIEW}>
        Detail pripravujeme.
      </div>
    </PageShell>
  );
}

